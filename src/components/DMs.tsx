import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { DMRequest, DM, OperationType, UserProfile } from '../types';
import { handleFirestoreError } from '../utils/errorHelper';
import { MessageSquare, Check, X, User, ArrowRight, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function DMs() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DMRequest[]>([]);
  const [dms, setDms] = useState<DM[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Listen for incoming DM requests
    const qReq = query(collection(db, 'dmRequests'), where('toUid', '==', user.uid), where('status', '==', 'pending'));
    const unsubReq = onSnapshot(qReq, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DMRequest));
      setRequests(reqs);
      reqs.forEach(r => fetchUserProfile(r.fromUid));
    });

    // Listen for active DMs
    const qDms = query(collection(db, 'dms'), where('members', 'array-contains', user.uid));
    const unsubDms = onSnapshot(qDms, (snapshot) => {
      const dmList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DM));
      setDms(dmList);
      dmList.forEach(dm => {
        const otherId = dm.members.find(m => m !== user.uid);
        if (otherId) fetchUserProfile(otherId);
      });
    });

    return () => {
      unsubReq();
      unsubDms();
    };
  }, [user]);

  const fetchUserProfile = async (uid: string) => {
    if (userProfiles[uid]) return;
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        setUserProfiles(prev => ({ ...prev, [uid]: docSnap.data() as UserProfile }));
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleAcceptRequest = async (req: DMRequest) => {
    try {
      // Update request status
      await updateDoc(doc(db, 'dmRequests', req.id), { status: 'accepted' });
      
      // Create DM session
      const dmData = {
        members: [req.fromUid, req.toUid],
        createdAt: new Date().toISOString(),
      };
      const dmRef = await addDoc(collection(db, 'dms'), dmData);
      navigate(`/dms/${dmRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `dmRequests/${req.id}`);
    }
  };

  const handleRejectRequest = async (req: DMRequest) => {
    try {
      await updateDoc(doc(db, 'dmRequests', req.id), { status: 'rejected' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `dmRequests/${req.id}`);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-12">
      {/* Requests Section */}
      {requests.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-900">
              <Clock size={20} />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900">Pending Requests</h2>
          </div>
          <div className="grid gap-4">
            {requests.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 overflow-hidden">
                    {userProfiles[req.fromUid]?.photoURL ? (
                      <img src={userProfiles[req.fromUid].photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900">{userProfiles[req.fromUid]?.displayName || 'Loading...'}</h4>
                    <p className="text-sm text-zinc-500">wants to connect with you</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRejectRequest(req)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={() => handleAcceptRequest(req)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all shadow-sm"
                  >
                    <Check size={18} />
                    <span>Accept</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Active DMs Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-900">
            <MessageSquare size={20} />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Direct Messages</h2>
        </div>
        
        {dms.length === 0 ? (
          <div className="bg-white rounded-3xl border border-zinc-200 border-dashed p-12 text-center">
            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">No messages yet</h3>
            <p className="text-zinc-500 max-w-xs mx-auto">
              Find people in groups and request a DM to start a private conversation.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {dms.map((dm) => {
              const otherId = dm.members.find(m => m !== user?.uid);
              const otherUser = otherId ? userProfiles[otherId] : null;

              return (
                <motion.div
                  key={dm.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/dms/${dm.id}`)}
                  className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 overflow-hidden">
                        {otherUser?.photoURL ? (
                          <img src={otherUser.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User size={28} />
                        )}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-zinc-900">{otherUser?.displayName || 'Loading...'}</h4>
                        <p className="text-sm text-zinc-500 truncate max-w-[200px]">
                          {otherUser?.bio || 'Click to start chatting'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-900 transition-colors">
                      <span className="text-xs font-medium uppercase tracking-wider hidden sm:inline">Open Chat</span>
                      <ArrowRight size={20} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
