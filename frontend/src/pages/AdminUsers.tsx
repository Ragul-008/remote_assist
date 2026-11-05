import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { 
  Users, Shield, UserCheck, UserX, Trash2, Search, 
  Loader2, RefreshCw, KeyRound, CheckCircle2, AlertTriangle, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'technician' | 'customer';
  is_active: boolean;
  created_at: string;
}

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Change role modal
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'technician' | 'customer'>('technician');
  const [showRoleModal, setShowRoleModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const fetchUsers = async () => {
    try {
      const params: any = {};
      if (roleFilter !== 'all') params.role = roleFilter;
      const res = await api.get('/users', { params });
      setUsers(res.data);
    } catch {
      toast.error('Failed to load users list');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await api.put(`/users/${selectedUser.id}/role`, {
        role: newRole,
      });
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? res.data : u));
      toast.success(`Role updated for ${selectedUser.name}`);
      setShowRoleModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update user role');
    }
  };

  const handleToggleActive = async (targetUser: UserItem) => {
    const nextActive = !targetUser.is_active;
    try {
      const res = await api.put(`/users/${targetUser.id}/role`, {
        role: targetUser.role,
        is_active: nextActive
      });
      setUsers(prev => prev.map(u => u.id === targetUser.id ? res.data : u));
      toast.success(`Account ${nextActive ? 'activated' : 'deactivated'} for ${targetUser.name}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update account status');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete user "${name}"?`)) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success('User deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            User Management & Permissions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage organization technicians, administrators, and client support access
          </p>
        </div>

        <button
          onClick={() => { setIsLoading(true); fetchUsers(); }}
          className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
          title="Refresh user list"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Filter Role:</span>
          {['all', 'admin', 'technician', 'customer'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                roleFilter === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
            Loading accounts...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-gray-500 dark:text-gray-400">
            No users found matching current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-750 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Joined Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredUsers.map(user => {
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-750/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                              {user.name}
                              {isSelf && (
                                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded font-semibold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                            : user.role === 'technician'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {user.role === 'admin' && <Shield className="w-3 h-3" />}
                          {user.role}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.is_active !== false
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${user.is_active !== false ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {user.is_active !== false ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setNewRole(user.role);
                              setShowRoleModal(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                            title="Change user role"
                          >
                            Change Role
                          </button>

                          {!isSelf && (
                            <>
                              <button
                                onClick={() => handleToggleActive(user)}
                                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                                  user.is_active !== false ? 'text-amber-500 hover:text-amber-600' : 'text-emerald-500 hover:text-emerald-600'
                                }`}
                                title={user.is_active !== false ? 'Deactivate account' : 'Activate account'}
                              >
                                {user.is_active !== false ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </button>

                              <button
                                onClick={() => handleDelete(user.id, user.name)}
                                className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change Role Modal */}
      <AnimatePresence>
        {showRoleModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white">Modify User Role</h3>
                <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-300">
                Selecting a new role for <strong>{selectedUser.name}</strong> ({selectedUser.email}):
              </div>

              <form onSubmit={handleUpdateRole} className="space-y-4">
                <div className="space-y-2">
                  {[
                    { role: 'admin', label: 'Administrator', desc: 'Full access to user management, audit logs, unattended computers, and all sessions' },
                    { role: 'technician', label: 'Technician', desc: 'Can start sessions, access assigned computers, and provide customer support' },
                    { role: 'customer', label: 'Customer', desc: 'Can join support sessions and view past support history' }
                  ].map(item => (
                    <label
                      key={item.role}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        newRole === item.role
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                      }`}
                    >
                      <input
                        type="radio"
                        name="userRole"
                        value={item.role}
                        checked={newRole === item.role}
                        onChange={() => setNewRole(item.role as any)}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">{item.label}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{item.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRoleModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Update Role
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUsers;

