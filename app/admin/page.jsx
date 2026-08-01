'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('shipments'); // 'shipments', 'cards', 'users'

  // Data State
  const [shipments, setShipments] = useState([]);
  const [cards, setCards] = useState([]);
  const [users, setUsers] = useState([]);

  // New Card Form State
  const [newCard, setNewCard] = useState({
    name: '',
    set_name: 'Base Set',
    card_number: '',
    rarity: 'Rare',
    price: '',
    stock_quantity: 10,
    image_url: '',
    is_popular: false,
  });

  // Verify Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch data on tab change
  useEffect(() => {
    if (user) {
      if (tab === 'shipments') fetchShipments();
      if (tab === 'cards') fetchCards();
      if (tab === 'users') fetchUsers();
    }
  }, [user, tab]);

  // --- Data Fetching Functions ---
  const fetchShipments = async () => {
    const { data, error } = await supabase
      .from('shipments')
      .select(`
        id,
        status,
        tracking_number,
        carrier,
        shipping_address,
        purchases (
          id,
          user_id,
          price_at_purchase,
          cards ( name, image_url )
        )
      `)
      .order('id', { ascending: false });

    if (error) console.error('Error fetching shipments:', error.message);
    else setShipments(data || []);
  };

  const fetchCards = async () => {
    const { data, error } = await supabase.from('cards').select('*').order('id', { ascending: true });
    if (error) console.error('Error fetching cards:', error.message);
    else setCards(data || []);
  };

  const fetchUsers = async () => {
    // Collect unique user IDs from purchases
    const { data, error } = await supabase
      .from('purchases')
      .select('user_id, purchased_at');

    if (error) {
      console.error('Error fetching user activity:', error.message);
      return;
    }

    // Map unique users and their activity count
    const userMap = {};
    (data || []).forEach((item) => {
      if (!userMap[item.user_id]) {
        userMap[item.user_id] = { user_id: item.user_id, purchase_count: 0, last_active: item.purchased_at };
      }
      userMap[item.user_id].purchase_count += 1;
    });

    setUsers(Object.values(userMap));
  };

  // --- Admin Actions ---
  const handleShipOrder = async (shipmentId) => {
    const trackingNum = 'PKMN-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const { error } = await supabase
      .from('shipments')
      .update({ status: 'Shipped', tracking_number: trackingNum })
      .eq('id', shipmentId);

    if (error) {
      alert(error.message);
    } else {
      alert(`🚀 Order shipped! Tracking Number: ${trackingNum}`);
      fetchShipments();
    }
  };

  const handleUpdateStock = async (cardId, currentStock, delta) => {
    const newStock = Math.max(0, currentStock + delta);
    const { error } = await supabase
      .from('cards')
      .update({ stock_quantity: newStock })
      .eq('id', cardId);

    if (error) alert(error.message);
    else fetchCards();
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCard.name || !newCard.price || !newCard.image_url) {
      return alert('Please fill in Name, Price, and Image URL.');
    }

    const { error } = await supabase.from('cards').insert([{
      ...newCard,
      price: parseFloat(newCard.price),
      stock_quantity: parseInt(newCard.stock_quantity, 10)
    }]);

    if (error) {
      alert(error.message);
    } else {
      alert('🎉 New Card Added to Marketplace!');
      setNewCard({
        name: '',
        set_name: 'Base Set',
        card_number: '',
        rarity: 'Rare',
        price: '',
        stock_quantity: 10,
        image_url: '',
        is_popular: false,
      });
      fetchCards();
    }
  };

  if (!user) {
    return (
      <div style={styles.container}>
        <h2>🛡️ Admin Dashboard</h2>
        <p>Please log in on the main store page first to access the admin panel.</p>
        <Link href="/" style={styles.linkBtn}>Return to Shop</Link>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2>🛡️ Admin Dashboard</h2>
          <small>Logged in as: <strong>{user.email}</strong></small>
        </div>
        <Link href="/" style={styles.linkBtn}>← Back to Store</Link>
      </div>

      {/* Admin Nav */}
      <nav style={styles.nav}>
        <button 
          style={tab === 'shipments' ? styles.activeTab : styles.tab} 
          onClick={() => setTab('shipments')}
        >
          📦 Shipments & Orders
        </button>
        <button 
          style={tab === 'cards' ? styles.activeTab : styles.tab} 
          onClick={() => setTab('cards')}
        >
          🃏 Manage Catalog & Stock
        </button>
        <button 
          style={tab === 'users' ? styles.activeTab : styles.tab} 
          onClick={() => setTab('users')}
        >
          👥 Registered Buyers
        </button>
      </nav>

      {/* Tab 1: Shipments Management */}
      {tab === 'shipments' && (
        <div>
          <h3>Pending & Completed Shipments</h3>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th>Shipment ID</th>
                <th>Card</th>
                <th>Address</th>
                <th>Status</th>
                <th>Tracking Number</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((item) => {
                const card = item.purchases?.cards;
                const isShipped = item.status === 'Shipped';
                return (
                  <tr key={item.id} style={styles.tableRow}>
                    <td>#{item.id}</td>
                    <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {card?.image_url && <img src={card.image_url} alt="" style={{ width: '30px', height: '40px', objectFit: 'contain' }} />}
                      {card?.name || 'Unknown Card'}
                    </td>
                    <td><small>{item.shipping_address || 'No Address'}</small></td>
                    <td>
                      <span style={isShipped ? styles.badgeShipped : styles.badgeProcessing}>
                        {item.status}
                      </span>
                    </td>
                    <td><code>{item.tracking_number || 'Unassigned'}</code></td>
                    <td>
                      {!isShipped ? (
                        <button onClick={() => handleShipOrder(item.id)} style={styles.actionBtn}>
                          🚀 Mark Shipped
                        </button>
                      ) : (
                        <span style={{ color: '#2e7d32', fontSize: '13px' }}>✓ Complete</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Manage Catalog & Stock */}
      {tab === 'cards' && (
        <div>
          {/* Add New Card Form */}
          <form onSubmit={handleAddCard} style={styles.formContainer}>
            <h3>➕ Add New Card to Store</h3>
            <div style={styles.formGrid}>
              <input 
                placeholder="Card Name (e.g. Charizard)" 
                value={newCard.name} 
                onChange={(e) => setNewCard({ ...newCard, name: e.target.value })} 
                required 
              />
              <input 
                placeholder="Set Name (e.g. Base Set)" 
                value={newCard.set_name} 
                onChange={(e) => setNewCard({ ...newCard, set_name: e.target.value })} 
              />
              <input 
                placeholder="Card Number (e.g. 4/102)" 
                value={newCard.card_number} 
                onChange={(e) => setNewCard({ ...newCard, card_number: e.target.value })} 
              />
              <input 
                placeholder="Rarity (e.g. Holo Rare)" 
                value={newCard.rarity} 
                onChange={(e) => setNewCard({ ...newCard, rarity: e.target.value })} 
              />
              <input 
                type="number" 
                step="0.01" 
                placeholder="Price ($)" 
                value={newCard.price} 
                onChange={(e) => setNewCard({ ...newCard, price: e.target.value })} 
                required 
              />
              <input 
                type="number" 
                placeholder="Initial Stock Quantity" 
                value={newCard.stock_quantity} 
                onChange={(e) => setNewCard({ ...newCard, stock_quantity: e.target.value })} 
                required 
              />
              <input 
                placeholder="Image URL" 
                value={newCard.image_url} 
                onChange={(e) => setNewCard({ ...newCard, image_url: e.target.value })} 
                style={{ gridColumn: 'span 2' }}
                required 
              />
            </div>
            <div style={{ marginTop: '10px' }}>
              <label>
                <input 
                  type="checkbox" 
                  checked={newCard.is_popular} 
                  onChange={(e) => setNewCard({ ...newCard, is_popular: e.target.checked })} 
                />
                {' '}Mark as Popular Card ⭐
              </label>
            </div>
            <button type="submit" style={{ ...styles.actionBtn, marginTop: '12px' }}>Save New Card</button>
          </form>

          {/* Cards Inventory List */}
          <h3>Existing Inventory Stock</h3>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th>ID</th>
                <th>Image</th>
                <th>Name</th>
                <th>Price</th>
                <th>Stock Level</th>
                <th>Stock Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id} style={styles.tableRow}>
                  <td>#{card.id}</td>
                  <td><img src={card.image_url} alt="" style={{ width: '35px', height: '48px', objectFit: 'contain' }} /></td>
                  <td><strong>{card.name}</strong> {card.is_popular ? '⭐' : ''}</td>
                  <td>${Number(card.price).toFixed(2)}</td>
                  <td><strong>{card.stock_quantity}</strong> units</td>
                  <td>
                    <button 
                      onClick={() => handleUpdateStock(card.id, card.stock_quantity, -1)}
                      style={styles.smallBtn}
                    >
                      -1
                    </button>
                    <button 
                      onClick={() => handleUpdateStock(card.id, card.stock_quantity, 1)}
                      style={styles.smallBtn}
                    >
                      +1
                    </button>
                    <button 
                      onClick={() => handleUpdateStock(card.id, card.stock_quantity, 10)}
                      style={styles.smallBtn}
                    >
                      +10
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Users */}
      {tab === 'users' && (
        <div>
          <h3>Active Customer Accounts</h3>
          <p><small>Shows registered buyers who have placed orders in the store.</small></p>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th>User UUID</th>
                <th>Total Purchases</th>
                <th>Last Purchase Date</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} style={styles.tableRow}>
                  <td><code>{u.user_id}</code></td>
                  <td><strong>{u.purchase_count}</strong> items purchased</td>
                  <td>{new Date(u.last_active).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: '1000px', margin: '20px auto', fontFamily: 'sans-serif', padding: '0 16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '12px' },
  nav: { display: 'flex', gap: '10px', margin: '20px 0' },
  tab: { padding: '8px 14px', border: '1px solid #ccc', background: '#f9f9f9', borderRadius: '4px', cursor: 'pointer' },
  activeTab: { backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '10px' },
  tableHeader: { background: '#f5f5f5', textAlign: 'left', borderBottom: '2px solid #ddd' },
  tableRow: { borderBottom: '1px solid #eee', padding: '8px' },
  actionBtn: { backgroundColor: '#0288d1', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  smallBtn: { backgroundColor: '#eee', border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginRight: '4px' },
  linkBtn: { padding: '6px 12px', backgroundColor: '#eee', color: '#333', textDecoration: 'none', borderRadius: '4px', fontSize: '14px' },
  badgeProcessing: { background: '#fff3e0', color: '#e65100', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgeShipped: { background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  formContainer: { background: '#f9f9f9', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #eee' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }
};