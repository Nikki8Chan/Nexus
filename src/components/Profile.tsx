import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, onSnapshot, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAuth } from '../App';
import { UserProfile, DMRequest, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHelper';
import { User, Mail, Calendar, Edit2, Check, MessageSquare, Send, Trash2, AlertTriangle, LogOut } from 'lucide-react';
import { motion } from 'motion/react';

export default function Profile() {
  const { uid } = useParams();
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const targetUid = uid || user?.uid;
  const isMe = targetUid === user?.uid;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [dmRequestStatus, setDmRequestStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!targetUid) return;

    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', targetUid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setProfile(data);
          setEditName(data.displayName);
          setEditBio(data.bio || '');
        }
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${targetUid}`);
      }
    };

    fetchProfile();

    if (!isMe && user) {
      const q = query(
        collection(db, 'dmRequests'),
        where('fromUid', '==', user.uid),
        where('toUid', '==', targetUid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const req = snapshot.docs[0].data() as DMRequest;
          setDmRequestStatus(req.status === 'accepted' ? 'accepted' : 'pending');
        }
      });
      return () => unsubscribe();
    }
  }, [targetUid, isMe, user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editName,
        bio: editBio,
      });
      setIsEditing(false);
      await refreshProfile();
      setProfile(prev => prev ? { ...prev, displayName: editName, bio: editBio } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleRequestDM = async () => {
    if (!user || !targetUid || dmRequestStatus !== 'none') return;
    try {
      await addDoc(collection(db, 'dmRequests'), {
        fromUid: user.uid,
        toUid: targetUid,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'dmRequests');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      // 1. Delete Firestore profile
      await deleteDoc(doc(db, 'users', user.uid));
      
      // 2. Delete Auth user
      await deleteUser(user);
      
      // 3. Redirect
      navigate('/auth');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        alert('For security reasons, you must have recently signed in to delete your account. Please sign out and sign back in, then try again.');
      } else {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}`);
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/auth');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading profile...</div>;
  if (!profile) return <div className="p-8 text-center text-zinc-500">Profile not found.</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden"
      >
        <div className="h-32 bg-zinc-900"></div>
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="w-24 h-24 bg-white p-1 rounded-3xl shadow-md">
              <div className="w-full h-full bg-zinc-100 rounded-2xl overflow-hidden flex items-center justify-center text-zinc-400">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={40} />
                )}
              </div>
            </div>
            {isMe ? (
              <div className="flex gap-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
                <button
                  onClick={() => isEditing ? handleUpdateProfile() : setIsEditing(true)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all ${
                    isEditing ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                  }`}
                >
                  {isEditing ? <Check size={18} /> : <Edit2 size={18} />}
                  <span>{isEditing ? 'Save Profile' : 'Edit Profile'}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleRequestDM}
                disabled={dmRequestStatus !== 'none'}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all ${
                  dmRequestStatus === 'accepted' 
                    ? 'bg-zinc-100 text-zinc-500' 
                    : dmRequestStatus === 'pending'
                    ? 'bg-zinc-100 text-zinc-500'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800'
                }`}
              >
                {dmRequestStatus === 'accepted' ? (
                  <><MessageSquare size={18} /> <span>Connected</span></>
                ) : dmRequestStatus === 'pending' ? (
                  <><Send size={18} /> <span>Request Sent</span></>
                ) : (
                  <><MessageSquare size={18} /> <span>Request DM</span></>
                )}
              </button>
            )}
          </div>

          <div className="space-y-6">
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-3xl font-bold text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              ) : (
                <h1 className="text-3xl font-bold text-zinc-900">{profile.displayName}</h1>
              )}
              <p className="text-zinc-500 flex items-center gap-2 mt-1">
                <Mail size={14} /> {profile.email}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">About</h3>
                {isEditing ? (
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    placeholder="Tell us about yourself..."
                  />
                ) : (
                  <p className="text-zinc-700 leading-relaxed">
                    {profile.bio || "This user hasn't added a bio yet."}
                  </p>
                )}
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-zinc-600">
                    <Calendar size={18} className="text-zinc-400" />
                    <span className="text-sm">Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-600">
                    <User size={18} className="text-zinc-400" />
                    <span className="text-sm">UID: {profile.uid.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isMe && (
            <div className="mt-12 pt-8 border-t border-zinc-100">
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-red-100 rounded-xl text-red-600">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-900">Danger Zone</h3>
                    <p className="text-red-700 mt-1 mb-4 text-sm">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
                      >
                        <Trash2 size={18} />
                        <span>Delete Account</span>
                      </button>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={isDeleting}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={isDeleting}
                          className="px-4 py-2 bg-white text-zinc-600 border border-zinc-200 rounded-xl font-semibold hover:bg-zinc-50 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
