import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

interface OrderItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  customerAddress: string;
  shippingName: string;
  shippingEmail: string;
  shippingMobile: string;
  shippingAddress: string;
  items: OrderItem[];
  totalQuantity: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  createdBy: string;
  createdByRole: string;
  notes?: string;
}

const DealerReceivedOrders = () => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const { user, getOrders } = useAuth();
  const [receivedOrders, setReceivedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const formatAddress = (addr: any): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  };

  // Orders where this dealer is the buyer and someone else (their manager,
  // admin, sales staff) placed the order.
  const loadReceivedOrders = useCallback(async () => {
    const myId = String(user?._id || '');
    if (!myId) {
      setReceivedOrders([]);
      setLoading(false);
      return;
    }
    try {
      setLoadError(null);
      const result = await getOrders({ dealerId: myId, limit: 100, sortBy: 'orderDate' });
      const rows: any[] = result?.success ? result.orders || [] : [];
      const mapped: Order[] = rows
        .filter((o) => {
          const creatorId = o.createdBy && typeof o.createdBy === 'object' ? String(o.createdBy._id || '') : String(o.createdBy || '');
          return creatorId && creatorId !== myId;
        })
        .map((o) => {
          const items: OrderItem[] = (o.items || []).map((it: any) => ({
            productId: String(it.productId?._id || it.productId || ''),
            productCode: it.productCode || it.productId?.productCode || '',
            productName: it.productName || it.productId?.productName || '',
            unit: it.unit || 'units',
            unitPrice: Number(it.unitPrice) || 0,
            quantity: Number(it.quantity) || 0,
            totalAmount: Number(it.totalPrice) || 0,
          }));
          const sub = o.subDealerId && typeof o.subDealerId === 'object' ? o.subDealerId : null;
          const dealer = o.dealerId && typeof o.dealerId === 'object' ? o.dealerId : null;
          return {
            _id: String(o._id),
            orderNumber: o.orderNumber || '',
            customerName: o.dealerName || o.customerName || dealer?.name || '',
            customerEmail: o.customerEmail || dealer?.email || '',
            customerMobile: o.customerMobile || dealer?.mobile || '',
            customerAddress: formatAddress(o.customerAddress),
            shippingName: o.subDealerName || sub?.name || o.dealerName || o.customerName || '',
            shippingEmail: sub?.email || '',
            shippingMobile: sub?.mobile || '',
            shippingAddress: formatAddress(o.shippingAddress),
            items,
            totalQuantity: items.reduce((sum, it) => sum + it.quantity, 0),
            totalAmount: Number(o.finalAmount) || 0,
            status: o.status || 'draft',
            createdAt: o.orderDate || o.createdAt,
            createdBy: o.createdBy?.name || 'Unknown',
            createdByRole: o.createdBy?.role || '',
            notes: o.notes || undefined,
          };
        });
      setReceivedOrders(mapped);
    } catch (error: any) {
      console.error('Failed to load received orders:', error);
      setLoadError(error?.message || 'Could not load received orders');
      setReceivedOrders([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    loadReceivedOrders();
  }, [loadReceivedOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReceivedOrders();
    setRefreshing(false);
  };

  const RECEIVED_ORDERS = receivedOrders;

  const formatValue = (amount: number) =>
    amount >= 100000 ? `₹${(amount / 100000).toFixed(1)}L` : `₹${Math.round(amount).toLocaleString()}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#B45309';
      case 'pending_approval': return '#B45309';
      case 'approved': return '#15803D';
      case 'sent_to_tally': return '#B8142F';
      case 'dispatched': return '#7D0B1E';
      case 'returned': return '#B91C1C';
      case 'processing': return '#B8142F';
      case 'shipped': return '#7D0B1E';
      case 'delivered': return '#15803D';
      case 'cancelled': return '#B91C1C';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return 'document-outline';
      case 'pending_approval': return 'time-outline';
      case 'sent_to_tally': return 'cloud-upload-outline';
      case 'dispatched': return 'car-outline';
      case 'approved': return 'checkmark-circle-outline';
      case 'processing': return 'time-outline';
      case 'shipped': return 'car-outline';
      case 'delivered': return 'checkmark-done-circle-outline';
      case 'cancelled': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const statusLabel = (status: string) =>
    status
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const renderOrderCard = (order: Order) => (
    <TouchableOpacity
      key={order._id}
      style={styles.orderCard}
      onPress={() => handleOrderPress(order)}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={12} color="#6B7280" />
            <Text style={styles.infoText}>{order.customerName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={12} color="#6B7280" />
            <Text style={styles.infoText}>{order.shippingName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="create-outline" size={12} color="#6B7280" />
            <Text style={styles.infoText}>
              {order.createdBy}{order.createdByRole ? ` (${order.createdByRole})` : ''}
            </Text>
          </View>
        </View>
        
        <View style={styles.orderStatus}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(order.status) + '20' }
          ]}>
            <Ionicons 
              name={getStatusIcon(order.status) as any} 
              size={16} 
              color={getStatusColor(order.status)} 
            />
            <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
              {statusLabel(order.status)}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.orderDetails}>
        <View style={styles.orderDetailRow}>
          <Text style={styles.orderDetailLabel}>Items</Text>
          <Text style={styles.orderDetailValue}>{order.items.length}</Text>
        </View>
        <View style={styles.orderDetailRow}>
          <Text style={styles.orderDetailLabel}>Quantity</Text>
          <Text style={styles.orderDetailValue}>{order.totalQuantity}</Text>
        </View>
        <View style={styles.orderDetailRow}>
          <Text style={styles.orderDetailLabel}>Total</Text>
          <Text style={styles.orderDetailValue}>₹{order.totalAmount.toLocaleString()}</Text>
        </View>
        <View style={styles.orderDetailRow}>
          <Text style={styles.orderDetailLabel}>Date</Text>
          <Text style={styles.orderDetailValue}>
            {new Date(order.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderOrderDetails = () => {
    if (!selectedOrder) return null;

    return (
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowDetailsModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={26} color="#111827" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <Text style={styles.modalSubtitle}>#{selectedOrder.orderNumber}</Text>
            </View>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Order Information */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Order Information</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order Number</Text>
                <Text style={styles.detailValue}>#{selectedOrder.orderNumber}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={[
                  styles.detailStatusBadge,
                  { backgroundColor: getStatusColor(selectedOrder.status) + '20' }
                ]}>
                  <Text style={[
                    styles.detailStatusText,
                    { color: getStatusColor(selectedOrder.status) }
                  ]}>
                    {statusLabel(selectedOrder.status)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created Date</Text>
                <Text style={styles.detailValue}>
                  {new Date(selectedOrder.createdAt).toLocaleDateString()} {' '}
                  {new Date(selectedOrder.createdAt).toLocaleTimeString()}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created By</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder.createdBy}{selectedOrder.createdByRole ? ` (${selectedOrder.createdByRole})` : ''}
                </Text>
              </View>
            </View>

            {/* Customer Information */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Customer (Dealer)</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{selectedOrder.customerName}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{selectedOrder.customerEmail}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Mobile</Text>
                <Text style={styles.detailValue}>{selectedOrder.customerMobile}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>{selectedOrder.customerAddress}</Text>
              </View>
            </View>

            {/* Shipping Information */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Shipping (Sub Dealer)</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{selectedOrder.shippingName}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{selectedOrder.shippingEmail}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Mobile</Text>
                <Text style={styles.detailValue}>{selectedOrder.shippingMobile}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>{selectedOrder.shippingAddress}</Text>
              </View>
            </View>

            {/* Order Items */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Order Items</Text>
              
              {selectedOrder.items.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.productName}</Text>
                      <Text style={styles.itemCode}>{item.productCode}</Text>
                      <Text style={styles.itemPrice}>
                        ₹{item.unitPrice.toLocaleString()}/{item.unit}
                      </Text>
                    </View>
                    <View style={styles.itemQuantity}>
                      <Text style={styles.itemQuantityText}>Qty: {item.quantity}</Text>
                      <Text style={styles.itemTotal}>₹{item.totalAmount.toLocaleString()}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Order Summary */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Items</Text>
                <Text style={styles.detailValue}>{selectedOrder.items.length}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Quantity</Text>
                <Text style={styles.detailValue}>{selectedOrder.totalQuantity}</Text>
              </View>
              
              <View style={[styles.detailRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>
                  ₹{selectedOrder.totalAmount.toLocaleString()}
                </Text>
              </View>
              
              {selectedOrder.notes && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>{selectedOrder.notes}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Order Details Modal */}
      {renderOrderDetails()}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Received Orders</Text>
        <Text style={styles.subtitle}>Orders assigned to you by your manager</Text>
      </View>

      {/* Summary Strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Ionicons name="document-text" size={20} color="#fff" />
          <Text style={styles.summaryVal}>{RECEIVED_ORDERS.length}</Text>
          <Text style={styles.summaryLab}>Total Orders</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryDivider]}>
          <Ionicons name="cube" size={20} color="#fff" />
          <Text style={styles.summaryVal}>
            {RECEIVED_ORDERS.reduce((sum, o) => sum + o.totalQuantity, 0)}
          </Text>
          <Text style={styles.summaryLab}>Total Items</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryDivider]}>
          <Ionicons name="cash" size={20} color="#fff" />
          <Text style={styles.summaryVal}>
            {formatValue(RECEIVED_ORDERS.reduce((sum, o) => sum + o.totalAmount, 0))}
          </Text>
          <Text style={styles.summaryLab}>Total Value</Text>
        </View>
      </View>

      {/* Orders List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#15803D" />
          </View>
        ) : RECEIVED_ORDERS.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 }}>
            <Ionicons name={loadError ? 'alert-circle-outline' : 'file-tray-outline'} size={48} color="#9CA3AF" />
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: '#111827' }}>
              {loadError ? 'Could not load orders' : 'No received orders yet'}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
              {loadError || 'Orders placed for you by your manager or the company will show here.'}
            </Text>
          </View>
        ) : (
          RECEIVED_ORDERS.map((order) => renderOrderCard(order))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  summaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 18,
    backgroundColor: '#15803D',
    marginHorizontal: 15,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 12,
    shadowColor: '#15803D',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.3)'
  },
  summaryVal: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4
  },
  summaryLab: {
    color: '#D1FAE5',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase'
  },

  scrollView: { flex: 1 },
  scrollContent: { padding: 15, paddingBottom: 40 },

  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  orderInfo: { flex: 1 },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1
  },
  orderStatus: { alignItems: 'flex-end' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600'
  },

  orderDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    gap: 6
  },
  orderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  orderDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500'
  },
  orderDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827'
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  closeButton: { padding: 4 },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827'
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2
  },
  modalContent: {
    flex: 1,
    padding: 15
  },

  detailsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    flex: 1
  },
  detailValue: {
    fontSize: 13,
    color: '#111827',
    flex: 2,
    textAlign: 'right'
  },
  detailStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  detailStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },

  itemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2
  },
  itemCode: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4
  },
  itemPrice: {
    fontSize: 12,
    color: '#15803D'
  },
  itemQuantity: {
    alignItems: 'flex-end'
  },
  itemQuantityText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#15803D'
  },

  totalRow: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB'
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827'
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#15803D'
  },
});

export default DealerReceivedOrders;