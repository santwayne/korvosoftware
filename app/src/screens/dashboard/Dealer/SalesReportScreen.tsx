import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../context/AuthContext';

interface SalesData {
  month: string;
  sales: number;
  orders: number;
  growth: number | null; // null when there is no earlier month to compare with
}

interface SalesStats {
  totalSales: number;
  totalOrders: number;
  averageGrowth: number | null;
  monthlyData: SalesData[];
}

const SalesReportScreen = () => {
  const navigation = useNavigation();
  const { user, getOrders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salesStats, setSalesStats] = useState<SalesStats>({
    totalSales: 0,
    totalOrders: 0,
    averageGrowth: 0,
    monthlyData: []
  });

  // Orders that count towards a dealer's sales: ones they placed and ones
  // placed for them. Cancelled/returned orders and drafts are left out.
  const COUNTED_STATUSES = ['pending_approval', 'approved', 'sent_to_tally', 'dispatched', 'delivered'];

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      const myId = String(user?._id || '');
      const [placed, received] = await Promise.all([
        getOrders({ createdBy: myId, limit: 500 }),
        getOrders({ dealerId: myId, limit: 500 }),
      ]);

      const byId = new Map<string, any>();
      [...(placed?.orders || []), ...(received?.orders || [])].forEach((o: any) => {
        if (o?._id) byId.set(String(o._id), o);
      });
      const orders = [...byId.values()].filter((o) => COUNTED_STATUSES.includes(o.status));

      // Last 6 months, oldest first
      const now = new Date();
      const buckets: SalesData[] = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const inMonth = orders.filter((o) => {
          const d = new Date(o.orderDate || o.createdAt);
          return d >= start && d < end;
        });
        buckets.push({
          month: start.toLocaleDateString('en-US', { month: 'long' }),
          sales: Math.round(inMonth.reduce((sum, o) => sum + (Number(o.finalAmount) || 0), 0)),
          orders: inMonth.length,
          growth: null,
        });
      }
      // Growth vs the month before; only when the month before had sales
      buckets.forEach((b, idx) => {
        const prev = buckets[idx - 1];
        if (prev && prev.sales > 0) {
          b.growth = Math.round(((b.sales - prev.sales) / prev.sales) * 100);
        }
      });

      const growths = buckets.map((b) => b.growth).filter((g): g is number => g !== null);
      setSalesStats({
        totalSales: buckets.reduce((sum, b) => sum + b.sales, 0),
        totalOrders: buckets.reduce((sum, b) => sum + b.orders, 0),
        averageGrowth: growths.length ? Math.round(growths.reduce((a, b) => a + b, 0) / growths.length) : null,
        monthlyData: buckets,
      });
    } catch (error) {
      console.error('Error fetching sales data:', error);
      Alert.alert('Error', 'Failed to load sales report');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSalesData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchSalesData();
  }, []);

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString()}`;
  };

  const formatGrowth = (growth: number | null) => {
    if (growth === null) return '—';
    const sign = growth >= 0 ? '+' : '';
    return `${sign}${growth}%`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7D0B1E" />
        <Text style={styles.loadingText}>Loading sales report...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sales Report</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter" size={20} color="#7D0B1E" />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Sales</Text>
          <Text style={styles.summaryValue}>{formatCurrency(salesStats.totalSales)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Orders</Text>
          <Text style={styles.summaryValue}>{salesStats.totalOrders}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Avg Growth</Text>
          <Text style={[styles.summaryValue, { 
            color: salesStats.averageGrowth === null ? '#6B7280' : salesStats.averageGrowth >= 0 ? '#15803D' : '#B91C1C' 
          }]}>
            {formatGrowth(salesStats.averageGrowth)}
          </Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {salesStats.monthlyData.map((item, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.salesHeader}>
              <Text style={styles.monthText}>{item.month}</Text>
              {item.growth !== null && (
                <View style={[styles.growthBadge, {
                  backgroundColor: item.growth >= 0 ? '#D1FAE5' : '#FEE2E2'
                }]}>
                  <Ionicons 
                    name={item.growth >= 0 ? 'trending-up' : 'trending-down'} 
                    size={14} 
                    color={item.growth >= 0 ? '#15803D' : '#B91C1C'} 
                  />
                  <Text style={[styles.growthText, {
                    color: item.growth >= 0 ? '#15803D' : '#B91C1C'
                  }]}>{formatGrowth(item.growth)}</Text>
                </View>
              )}
            </View>
            <View style={styles.salesDetails}>
              <View style={styles.salesItem}>
                <Ionicons name="trending-up" size={18} color="#7D0B1E" />
                <View style={styles.salesItemInfo}>
                  <Text style={styles.salesItemLabel}>Sales</Text>
                  <Text style={styles.salesItemValue}>{formatCurrency(item.sales)}</Text>
                </View>
              </View>
              <View style={styles.salesItem}>
                <Ionicons name="cart-outline" size={18} color="#15803D" />
                <View style={styles.salesItemInfo}>
                  <Text style={styles.salesItemLabel}>Orders</Text>
                  <Text style={styles.salesItemValue}>{item.orders}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
        
        {/* Performance Insights */}
        <View style={styles.insightsCard}>
          <Text style={styles.insightsTitle}>Performance Insights</Text>
          <View style={styles.insightItem}>
            <Ionicons name="analytics-outline" size={20} color="#7D0B1E" />
            <View style={styles.insightContent}>
              <Text style={styles.insightLabel}>Best Performing Month</Text>
              <Text style={styles.insightValue}>
                {salesStats.totalSales > 0
                  ? salesStats.monthlyData.reduce((best, current) => 
                      current.sales > best.sales ? current : best
                    ).month
                  : 'N/A'
                }
              </Text>
            </View>
          </View>
          <View style={styles.insightItem}>
            <Ionicons name="trending-up-outline" size={20} color="#15803D" />
            <View style={styles.insightContent}>
              <Text style={styles.insightLabel}>Average Order Value</Text>
              <Text style={styles.insightValue}>
                {salesStats.totalOrders > 0 
                  ? formatCurrency(Math.round(salesStats.totalSales / salesStats.totalOrders))
                  : 'N/A'
                }
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  salesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  salesDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  salesItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  salesItemInfo: {
    marginLeft: 10,
  },
  salesItemLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  salesItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  insightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightContent: {
    marginLeft: 12,
    flex: 1,
  },
  insightLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  insightValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
});

export default SalesReportScreen;
