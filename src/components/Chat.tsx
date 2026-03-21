import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, limit, updateDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Message, Group, DM, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHelper';
import { Send, ArrowLeft, Info, User, Shield, Reply, Forward, Smile, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatProps {
  type: 'group' | 'dm';
}

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '😢'];

export default function Chat({ type }: ChatProps) {
  const { groupId, dmId } = useParams();
  const id = type === 'group' ? groupId : dmId;
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [info, setInfo] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [availableDestinations, setAvailableDestinations] = useState<{id: string, name: string, type: 'group' | 'dm'}[]>([]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;

    const fetchInfo = async () => {
      try {
        const docRef = doc(db, type === 'group' ? 'groups' : 'dms', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setInfo({ id: docSnap.id, ...docSnap.data() });
        } else {
          navigate('/');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `${type}s/${id}`);
      }
    };

    fetchInfo();

    const messagesQuery = query(
      collection(db, type === 'group' ? 'groups' : 'dms', id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `${type}s/${id}/messages`);
    });

    return () => unsubscribe();
  }, [id, type, navigate]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const isScrolledUp = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight > 200;
      setShowScrollBottom(isScrolledUp);
    };

    scrollEl.addEventListener('scroll', handleScroll);
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (showForwardModal && user) {
      const fetchDestinations = async () => {
        try {
          const groupsSnap = await getDocs(query(collection(db, 'groups'), where('members', 'array-contains', user.uid)));
          const dmsSnap = await getDocs(query(collection(db, 'dms'), where('members', 'array-contains', user.uid)));
          
          const groups = groupsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, type: 'group' as const }));
          const dms = dmsSnap.docs.map(doc => ({ id: doc.id, name: 'Direct Message', type: 'dm' as const }));
          
          setAvailableDestinations([...groups, ...dms]);
        } catch (error) {
          console.error('Error fetching destinations:', error);
        }
      };
      fetchDestinations();
    }
  }, [showForwardModal, user]);

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !id || !profile) return;

    const text = newMessage;
    const replyData = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      senderName: replyingTo.senderName
    } : null;

    setNewMessage('');
    setReplyingTo(null);

    try {
      const messageData: any = {
        text,
        senderId: user.uid,
        senderName: profile.displayName,
        createdAt: new Date().toISOString(),
      };
      
      if (replyData) {
        messageData.replyTo = replyData;
      }

      await addDoc(collection(db, type === 'group' ? 'groups' : 'dms', id, 'messages'), messageData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${type}s/${id}/messages`);
    }
  };

  const handleForwardMessage = async (destId: string, destType: 'group' | 'dm') => {
    if (!forwardingMessage || !user || !profile) return;

    try {
      await addDoc(collection(db, destType === 'group' ? 'groups' : 'dms', destId, 'messages'), {
        text: forwardingMessage.text,
        senderId: user.uid,
        senderName: profile.displayName,
        createdAt: new Date().toISOString(),
        forwardedFrom: forwardingMessage.senderName,
      });
      setShowForwardModal(false);
      setForwardingMessage(null);
      if (destId !== id) {
        navigate(destType === 'group' ? `/groups/${destId}` : `/dms/${destId}`);
      }
    } catch (error) {
      console.error('Error forwarding message:', error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user || !id) return;

    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = { ...(message.reactions || {}) };
    const alreadyHadThisEmoji = (currentReactions[emoji] || []).includes(user.uid);

    // Remove user from ALL existing reactions
    Object.keys(currentReactions).forEach(key => {
      currentReactions[key] = (currentReactions[key] || []).filter(uid => uid !== user.uid);
      if (currentReactions[key].length === 0) {
        delete currentReactions[key];
      }
    });

    // If they didn't have this specific emoji before, add it (replace old)
    // If they did have it, it's now removed (toggle off)
    if (!alreadyHadThisEmoji) {
      currentReactions[emoji] = [...(currentReactions[emoji] || []), user.uid];
    }

    try {
      await updateDoc(doc(db, type === 'group' ? 'groups' : 'dms', id, 'messages', messageId), {
        reactions: currentReactions
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${type}s/${id}/messages/${messageId}`);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white md:bg-zinc-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-100 rounded-full md:hidden">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
            {type === 'group' ? <Shield size={20} /> : <User size={20} />}
          </div>
          <div>
            <h2 className="font-bold text-zinc-900 leading-tight">
              {type === 'group' ? info?.name : 'Direct Message'}
            </h2>
            <p className="text-xs text-zinc-500">
              {type === 'group' ? `${info?.members.length} members` : 'Private Chat'}
            </p>
          </div>
        </div>
        <button className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400">
          <Info size={20} />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
          onClick={() => setActiveMessageId(null)}
        >
          {messages.map((msg, idx) => {
            const isMe = msg.senderId === user?.uid;
            const showName = idx === 0 || messages[idx - 1].senderId !== msg.senderId;

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMessageId(activeMessageId === msg.id ? null : msg.id);
                }}
              >
                {showName && !isMe && (
                  <span className="text-xs font-medium text-zinc-400 mb-1 ml-2">{msg.senderName}</span>
                )}
                
                <div className={`relative flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm relative transition-all ${
                      isMe 
                        ? 'bg-zinc-900 text-white rounded-tr-none' 
                        : 'bg-white border border-zinc-200 text-zinc-900 rounded-tl-none'
                    } ${activeMessageId === msg.id ? 'ring-2 ring-zinc-400 ring-offset-2' : ''}`}
                  >
                    {/* Forwarded Tag */}
                    {msg.forwardedFrom && (
                      <div className="flex items-center gap-1 text-[10px] opacity-60 mb-1 italic">
                        <Forward size={10} />
                        <span>Forwarded from {msg.forwardedFrom}</span>
                      </div>
                    )}

                    {/* Reply Context */}
                    {msg.replyTo && (
                      <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${
                        isMe ? 'bg-white/10 border-white/30' : 'bg-zinc-50 border-zinc-300'
                      }`}>
                        <div className="font-bold opacity-80">{msg.replyTo.senderName}</div>
                        <div className="opacity-60 truncate">{msg.replyTo.text}</div>
                      </div>
                    )}

                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                    {/* Reactions Display */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`absolute -bottom-3 flex flex-wrap gap-1 ${isMe ? 'right-0' : 'left-0'}`}>
                        {Object.entries(msg.reactions).map(([emoji, uids]) => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReaction(msg.id, emoji);
                            }}
                            className={`px-1.5 py-0.5 rounded-full text-[10px] border flex items-center gap-1 transition-all ${
                              (uids as string[]).includes(user?.uid || '')
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{(uids as string[]).length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {/* Message Actions (Visible on Hover or Active) */}
                  <div className={`flex items-center gap-1 transition-opacity ${isMe ? 'flex-row-reverse' : 'flex-row'} ${activeMessageId === msg.id ? 'opacity-100' : 'opacity-0 md:group-hover/msg:opacity-100'}`}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyingTo(msg);
                        setActiveMessageId(null);
                      }}
                      className="p-2 hover:bg-zinc-200 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors"
                      title="Reply"
                    >
                      <Reply size={18} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setForwardingMessage(msg);
                        setShowForwardModal(true);
                        setActiveMessageId(null);
                      }}
                      className="p-2 hover:bg-zinc-200 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors"
                      title="Forward"
                    >
                      <Forward size={18} />
                    </button>
                    <div className="relative group/reactions">
                      <button 
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-zinc-200 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors"
                      >
                        <Smile size={18} />
                      </button>
                      <div className={`absolute bottom-full mb-2 flex bg-white border border-zinc-200 rounded-full p-1 shadow-lg z-20 transition-all ${isMe ? 'right-0' : 'left-0'} ${activeMessageId === msg.id ? 'scale-100 opacity-100' : 'scale-0 opacity-0 md:group-hover/reactions:scale-100 md:group-hover/reactions:opacity-100'}`}>
                        {REACTION_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReaction(msg.id, emoji);
                              setActiveMessageId(null);
                            }}
                            className="p-2 hover:bg-zinc-100 rounded-full text-xl transition-transform hover:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollBottom && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: 'smooth'
                  });
                }
              }}
              className="absolute bottom-4 right-4 p-3 bg-white border border-zinc-200 rounded-full shadow-lg text-zinc-900 hover:bg-zinc-50 transition-all z-30"
            >
              <ArrowLeft size={20} className="-rotate-90" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Reply Preview */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-zinc-100 border-t border-zinc-200 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 border-l-4 border-zinc-900 pl-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-zinc-900">{replyingTo.senderName}</div>
                <div className="text-xs text-zinc-500 truncate">{replyingTo.text}</div>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-zinc-200 rounded-full text-zinc-400">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-4 bg-white border-t border-zinc-200 md:bg-transparent md:border-t-0">
        <form 
          onSubmit={handleSendMessage}
          className="max-w-4xl mx-auto flex items-center gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm focus-within:ring-2 focus-within:ring-zinc-900/10 transition-all"
        >
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-transparent focus:outline-none text-zinc-900"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-all"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Forward Modal */}
      <AnimatePresence>
        {showForwardModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-zinc-900">Forward Message</h2>
                <button onClick={() => setShowForwardModal(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {availableDestinations.map((dest) => (
                  <button
                    key={dest.id}
                    onClick={() => handleForwardMessage(dest.id, dest.type)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 rounded-2xl transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                      {dest.type === 'group' ? <Shield size={20} /> : <User size={20} />}
                    </div>
                    <div>
                      <div className="font-bold text-zinc-900">{dest.name}</div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider">{dest.type}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
