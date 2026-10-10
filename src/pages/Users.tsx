import React, { useState, useMemo } from 'react';
import { exportToExcel } from '@/utils/exportToExcel';
import { User, Ban, Trash2, Eye, MoreVertical, UserX, UserCheck, Download } from 'lucide-react';
import SearchBar from '@/components/admin/SearchBar';
import Table from '@/components/admin/Table';
import Pagination from '@/components/admin/Pagination';
import StatusBadge, { getStatusVariant } from '@/components/admin/StatusBadge';
import Modal from '@/components/admin/Modal';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { formatCurrency } from '@/utils/gstCalculator';
import { useAdminData } from '@/context/AdminDataContext';
import { User as UserType } from '@/services/adminApi';
import { cn } from '@/lib/utils';

const Users: React.FC = () => {
  const { state, toggleUserStatus, deleteUser } = useAdminData();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'delete' | 'block' | 'unblock';
    userId: string;
    userName: string;
  }>({
    isOpen: false,
    type: 'delete',
    userId: '',
    userName: '',
  });
  const [isActionLoading, setIsActionLoading] = useState(false);

  const pageSize = 10;

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    return state.users.filter(
      (user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.mobile.includes(searchQuery)
    );
  }, [state.users, searchQuery]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleViewUser = (user: UserType) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
    setActiveDropdown(null);
  };

  const handleToggleStatusClick = (user: UserType) => {
    setConfirmDialog({
      isOpen: true,
      type: user.status === 'active' ? 'block' : 'unblock',
      userId: user.id,
      userName: user.name,
    });
    setActiveDropdown(null);
  };

  const handleDeleteClick = (user: UserType) => {
    setConfirmDialog({
      isOpen: true,
      type: 'delete',
      userId: user.id,
      userName: user.name,
    });
    setActiveDropdown(null);
  };

  const handleConfirmAction = async () => {
    setIsActionLoading(true);
    
    if (confirmDialog.type === 'delete') {
      await deleteUser(confirmDialog.userId);
    } else {
      await toggleUserStatus(confirmDialog.userId);
    }
    
    setIsActionLoading(false);
    setConfirmDialog({ ...confirmDialog, isOpen: false });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    if (activeDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeDropdown]);

  const columns = [
    {
      key: 'id',
      header: 'User ID',
      render: (user: UserType) => (
        <span className="font-medium text-foreground">{user.id}</span>
      ),
    },
    {
      key: 'name',
      header: 'User',
      render: (user: UserType) => (
        <div className="flex items-center gap-3">
          <img
            src={user.profileImage}
            alt={user.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'mobile',
      header: 'Mobile',
      render: (user: UserType) => (
        <span className="text-muted-foreground">{user.mobile}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: UserType) => (
        <StatusBadge variant={getStatusVariant(user.status)}>
          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
        </StatusBadge>
      ),
    },
    {
      key: 'totalOrders',
      header: 'Orders',
      render: (user: UserType) => (
        <span className="text-muted-foreground">{user.totalOrders}</span>
      ),
    },
    {
      key: 'totalAmountSpent',
      header: 'Total Spent',
      render: (user: UserType) => (
        <span className="font-medium">{formatCurrency(user.totalAmountSpent)}</span>
      ),
    },
    {
      key: 'joiningDate',
      header: 'Joined',
      render: (user: UserType) => (
        <span className="text-sm text-muted-foreground">{formatDate(user.joiningDate)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user: UserType) => (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown(activeDropdown === user.id ? null : user.id);
            }}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>

          {activeDropdown === user.id && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-lg shadow-elevated z-10 animate-scale-in">
              <button
                onClick={() => handleViewUser(user)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>
              <button
                onClick={() => handleToggleStatusClick(user)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                {user.status === 'active' ? (
                  <>
                    <UserX className="w-4 h-4" />
                    Block User
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Unblock User
                  </>
                )}
              </button>
              <button
                onClick={() => handleDeleteClick(user)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete User
              </button>
            </div>
          )}
        </div>
      ),
    },
  ];

  const getConfirmDialogProps = () => {
    switch (confirmDialog.type) {
      case 'delete':
        return {
          title: 'Delete User?',
          message: `Are you sure you want to delete "${confirmDialog.userName}"? This action cannot be undone.`,
          confirmText: 'Delete',
          variant: 'danger' as const,
        };
      case 'block':
        return {
          title: 'Block User?',
          message: `Are you sure you want to block "${confirmDialog.userName}"? They won't be able to access the platform.`,
          confirmText: 'Block',
          variant: 'warning' as const,
        };
      case 'unblock':
        return {
          title: 'Unblock User?',
          message: `Are you sure you want to unblock "${confirmDialog.userName}"? They will regain access to the platform.`,
          confirmText: 'Unblock',
          variant: 'success' as const,
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Users</h1>
          <p className="page-description">
            Manage your platform users • {state.users.length} total
          </p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3">
          <button onClick={() => exportToExcel(state.users || [], 'users')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"><Download className="w-4 h-4" /> Export to Excel</button>
            <SearchBar
            placeholder="Search by name, email, or mobile..."
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-full sm:w-80"
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="text-2xl font-bold text-foreground">{state.users.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-success">
            {state.users.filter(u => u.status === 'active').length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Blocked</p>
          <p className="text-2xl font-bold text-destructive">
            {state.users.filter(u => u.status === 'blocked').length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(state.users.reduce((sum, u) => sum + u.totalAmountSpent, 0))}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <Table
          columns={columns}
          data={paginatedUsers}
          keyExtractor={(user) => user.id}
          emptyMessage="No users found"
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* View User Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="User Details"
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <img
                src={selectedUser.profileImage}
                alt={selectedUser.name}
                className="w-20 h-20 rounded-full object-cover"
              />
              <div>
                <h3 className="text-lg font-semibold text-foreground">{selectedUser.name}</h3>
                <p className="text-muted-foreground">{selectedUser.email}</p>
                <StatusBadge variant={getStatusVariant(selectedUser.status)} className="mt-2">
                  {selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1)}
                </StatusBadge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="font-medium text-foreground">{selectedUser.id}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Mobile</p>
                <p className="font-medium text-foreground">{selectedUser.mobile}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="font-medium text-foreground">{selectedUser.totalOrders}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="font-medium text-foreground">
                  {formatCurrency(selectedUser.totalAmountSpent)}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg col-span-2">
                <p className="text-sm text-muted-foreground">Joined On</p>
                <p className="font-medium text-foreground">{formatDate(selectedUser.joiningDate)}</p>
              </div>
            </div>

            {/* Quick Actions in Modal */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
              <button
                onClick={() => {
                  handleToggleStatusClick(selectedUser);
                  setIsViewModalOpen(false);
                }}
                className={cn(
                  'flex-1 py-2 rounded-lg font-medium transition-colors',
                  selectedUser.status === 'active'
                    ? 'bg-warning/10 text-warning hover:bg-warning/20'
                    : 'bg-success/10 text-success hover:bg-success/20'
                )}
              >
                {selectedUser.status === 'active' ? 'Block User' : 'Unblock User'}
              </button>
              <button
                onClick={() => {
                  handleDeleteClick(selectedUser);
                  setIsViewModalOpen(false);
                }}
                className="flex-1 py-2 rounded-lg font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                Delete User
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleConfirmAction}
        isLoading={isActionLoading}
        {...getConfirmDialogProps()}
      />
    </div>
  );
};

export default Users;
