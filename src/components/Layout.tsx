import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, Users, User, LogOut, Search } from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from '../App';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/auth');
  };

  const navItems = [
    { path: '/', icon: Users, label: 'Groups' },
    { path: '/dms', icon: MessageSquare, label: 'Messages' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  const isChatRoute = location.pathname.startsWith('/groups/') || location.pathname.startsWith('/dms/');

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar / Bottom Nav */}
      <nav className={`fixed bottom-0 left-0 right-0 md:relative md:w-64 bg-white border-t md:border-t-0 md:border-r border-zinc-200 z-50 transition-transform duration-300 ${isChatRoute ? 'translate-y-full md:translate-y-0' : 'translate-y-0'}`}>
        <div className="flex md:flex-col h-16 md:h-screen p-2 md:p-4 justify-around md:justify-start gap-2">
          <div className="hidden md:flex items-center gap-3 mb-8 px-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">N</span>
            </div>
            <span className="font-semibold text-zinc-900">Nexus</span>
          </div>

          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                location.pathname === item.path
                  ? 'bg-zinc-900 text-white shadow-md'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <item.icon size={20} />
              <span className="hidden md:inline font-medium">{item.label}</span>
            </Link>
          ))}

          <div className="mt-auto hidden md:block px-2">
            <div className="flex items-center gap-3 p-2 mb-4 bg-zinc-50 rounded-xl border border-zinc-100">
              <div className="w-10 h-10 bg-zinc-200 rounded-full overflow-hidden">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <User size={20} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">{profile?.displayName}</p>
                <p className="text-xs text-zinc-500 truncate">Online</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto h-screen transition-all ${isChatRoute ? 'pb-0' : 'pb-16 md:pb-0'}`}>
        <Outlet />
      </main>
    </div>
  );
}
