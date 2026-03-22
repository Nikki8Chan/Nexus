import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, arrayUnion, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Group, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHelper';
import { Plus, Search, Users, Lock, ArrowRight, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [joiningGroup, setJoiningGroup] = useState<Group | null>(null);
  const [joinPasscode, setJoinPasscode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    // Fetch all groups so people can "find" them
    const q = query(collection(db, 'groups'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      setGroups(groupsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'groups');
    });
    return () => unsubscribe();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;
    if (isPrivate && newPasscode.length !== 6) {
      alert('Private groups require a 6-digit passcode.');
      return;
    }

    try {
      const groupData = {
        name: newGroupName,
        description: newGroupDesc,
        isPrivate,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: new Date().toISOString(),
      };
      
      const docRef = await addDoc(collection(db, 'groups'), groupData);
      
      if (isPrivate) {
        // Store passcode in a separate collection for security
        await setDoc(doc(db, 'groupPasscodes', docRef.id), {
          passcode: newPasscode,
          groupId: docRef.id,
          createdBy: user.uid
        });
      }

      setShowCreate(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setIsPrivate(false);
      setNewPasscode('');
      navigate(`/groups/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groups');
    }
  };

  const handleJoinGroup = async (group: Group) => {
    if (!user) return;
    if (group.members.includes(user.uid)) {
      navigate(`/groups/${group.id}`);
      return;
    }

    if (group.isPrivate) {
      setJoiningGroup(group);
      setJoinPasscode('');
      setJoinError('');
      return;
    }

    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: arrayUnion(user.uid)
      });
      navigate(`/groups/${group.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    }
  };

  const handleConfirmJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joiningGroup || joinPasscode.length !== 6) return;

    setIsJoining(true);
    setJoinError('');

    try {
      // 1. Create a join request that is validated by security rules against the passcode
      const joinId = `${user.uid}_${joiningGroup.id}`;
      await setDoc(doc(db, 'groupJoins', joinId), {
        userId: user.uid,
        groupId: joiningGroup.id,
        passcode: joinPasscode,
        createdAt: new Date().toISOString()
      });

      // 2. If the above succeeded, the passcode was correct (per rules)
      // Now add the user to the group
      await updateDoc(doc(db, 'groups', joiningGroup.id), {
        members: arrayUnion(user.uid)
      });

      setJoiningGroup(null);
      navigate(`/groups/${joiningGroup.id}`);
    } catch (error: any) {
      setJoinError('Incorrect passcode. Please try again.');
      console.error("Join error:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Discover Groups</h1>
          <p className="text-zinc-500">Join communities that interest you.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl font-semibold hover:bg-zinc-800 transition-all shadow-sm"
        >
          <Plus size={20} />
          <span>Create Group</span>
        </button>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
        <input
          type="text"
          placeholder="Search groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGroups.map((group) => (
          <motion.div
            key={group.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900">
                <Users size={24} />
              </div>
              {group.isPrivate && <Lock size={16} className="text-zinc-400" />}
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">{group.name}</h3>
            <p className="text-zinc-500 text-sm mb-6 line-clamp-2 min-h-[40px]">
              {group.description || 'No description provided.'}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {group.members.length} members
              </span>
              <button
                onClick={() => handleJoinGroup(group)}
                className="flex items-center gap-2 text-zinc-900 font-semibold hover:gap-3 transition-all"
              >
                {group.members.includes(user?.uid || '') ? 'Open' : 'Join'}
                <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8"
            >
              <h2 className="text-2xl font-bold text-zinc-900 mb-6">Create New Group</h2>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Group Name</label>
                  <input
                    required
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    placeholder="e.g. Tech Enthusiasts"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                  <textarea
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 h-24 resize-none"
                    placeholder="What is this group about?"
                  />
                </div>
                <div className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <label htmlFor="isPrivate" className="text-sm font-medium text-zinc-700">
                    Make this group private
                  </label>
                </div>

                {isPrivate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="block text-sm font-medium text-zinc-700 mb-1">6-Digit Passcode</label>
                    <input
                      required
                      type="text"
                      maxLength={6}
                      pattern="\d{6}"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-mono tracking-widest text-center text-xl"
                      placeholder="000000"
                    />
                    <p className="text-xs text-zinc-500">Users will need this code to join.</p>
                  </motion.div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all shadow-sm"
                  >
                    Create Group
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {joiningGroup && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-zinc-900">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">Private Group</h2>
              <p className="text-zinc-500 mb-6">Enter the 6-digit passcode to join <b>{joiningGroup.name}</b></p>
              
              <form onSubmit={handleConfirmJoin} className="space-y-6">
                <div>
                  <input
                    required
                    autoFocus
                    type="text"
                    maxLength={6}
                    pattern="\d{6}"
                    value={joinPasscode}
                    onChange={(e) => setJoinPasscode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-mono tracking-[0.5em] text-center text-3xl"
                    placeholder="••••••"
                  />
                  {joinError && (
                    <p className="text-red-500 text-sm mt-3">{joinError}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setJoiningGroup(null)}
                    className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isJoining || joinPasscode.length !== 6}
                    className="flex-1 px-6 py-3 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all shadow-sm disabled:opacity-50"
                  >
                    {isJoining ? 'Joining...' : 'Join Group'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
