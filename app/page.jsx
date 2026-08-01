'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('store'); // 'store', 'inventory', 'history'
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Data state
  const [cards, setCards] = useState([]);
  const [popularOnly, setPopularOnly] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [address, setAddress] = useState('123 Pallet Town Way');

  // Sync Supabase Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Marketplace Cards
  useEffect(() => {
    fetchCards();
  }, [popularOnly]);

  // Fetch User Data
  useEffect(() => {
    if (user) loadUserData();
  }, [user, tab]);

  const fetchCards = async () => {
    try {
      let query = supabase.from('cards').select('*');
      if (popularOnly) query = query.eq('is_popular', true);

      const { data, error } = await query;
      if (error) console.error('Error fetching cards:', error.message);
      else setCards(data || []);
    } catch (err) {
      console.error('Failed to fetch cards:', err);
    }
  };

  const handleAuth = async (isRegister = false) => {
    try {
      let result;
      if (isRegister) {
        result = await supabase.auth.signUp({ email, password });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }

      if (result.error) alert(result.error.message);
      else if (isRegister) alert('Registration successful! You can now log in.');
    } catch (err) {
      alert('Authentication failed.');
    }
  };

  const loadUserData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          id,
          price_at_purchase,
          purchased_at,
          cards ( id, name, rarity, image_url ),
          shipments ( id, status, tracking_number, carrier, shipping_address )
        `)
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false });

      if (error) {
        console.error('Error fetching user data:', error.message);
        return;
      }

      const formatted = (data || []).map((p) => ({
        purchase_id: p.id,
        card_id: p.cards?.id,
        name: p.cards?.name || 'Unknown Card',
        rarity: p.cards?.rarity || 'Common',
        image_url: p.cards?.image_url || '',
        price_at_purchase: p.price_at_purchase,
        purchased_at: p.purchased_at,
        shipping_status: p.shipments?.[0]?.status || 'Processing',
        tracking_number: p.shipments?.[0]?.tracking_number || null,
        carrier: p.shipments?.[0]?.carrier || 'USPS',
        shipping_address: p.shipments?.[0]?.shipping_address || ''
      }));

      setInventory(formatted);
      setPurchases(formatted);
    } catch (err) {
      console.error('Failed to load user data:', err);
    }
  };

  const handleBuy = async (cardId) => {
    if (!user) return alert('Please login to purchase cards!');

    try {
      const { data, error } = await supabase.rpc('buy_card', {
        p_user_id: user.id,
        p_card_id: cardId,
        p_address: address
      });

      if (error) {
        alert(error.message);
      } else {
        alert('🎉 Purchase successful! Card added to inventory (Processing).');
        fetchCards();
        loadUserData();
      }
    } catch (err) {
      alert('Transaction failed.');
    }
  };

  const handleShipItem = async (purchaseId) => {
    if (!purchaseId) return alert('Missing Purchase ID.');

    try {
      const trackingNum = 'PKMN-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      const { error } = await supabase
        .from('shipments')
        .update({ status: 'Shipped', tracking_number: trackingNum })
        .eq('purchase_id', purchaseId)
        .eq('status', 'Processing');

      if (error) {
        alert(error.message);
      } else {
        alert(`🚀 Card shipped! Tracking: ${trackingNum}`);
        loadUserData();
      }
    } catch (err) {
      alert('Shipping failed.');
    }
  };

  return (
    <div style={styles.container}>
      {/* Header & Auth */}
      <header style={styles.header}>
        <h1>⚡ Pokémon Card Shop</h1>
        {user ? (
          <div>
            <span>Welcome, <strong>{user.email}</strong>! </span>
            <button onClick={() => supabase.auth.signOut()} style={styles.secondaryBtn}>Logout</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              placeholder="Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
            <button onClick={() => handleAuth(false)}>Login</button>
            <button onClick={() => handleAuth(true)} style={styles.secondaryBtn}>Register</button>
          </div>
        )}
      </header>

      {/* Navigation */}
      <nav style={styles.nav}>
        <button 
          style={tab === 'store' ? styles.activeTab : styles.tab} 
          onClick={() => setTab('store')}
        >
          🏪 Marketplace
        </button>
        {user && (
          <>
            <button 
              style={tab === 'inventory' ? styles.activeTab : styles.tab} 
              onClick={() => setTab('inventory')}
            >
              🎒 My Inventory ({inventory.length})
            </button>
            <button 
              style={tab === 'history' ? styles.activeTab : styles.tab} 
              onClick={() => setTab('history')}
            >
              📦 Orders & Tracking ({purchases.length})
            </button>
          </>
        )}
      </nav>

      {/* Marketplace Tab */}
      {tab === 'store' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <label>
              <input 
                type="checkbox" 
                checked={popularOnly} 
                onChange={(e) => setPopularOnly(e.target.checked)} 
              />
              {' '}Show Popular Cards Only
            </label>
            {user && (
              <div style={{ marginTop: '8px' }}>
                <small>Default Shipping Address: </small>
                <input 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  style={{ width: '250px' }} 
                />
              </div>
            )}
          </div>

          <div style={styles.grid}>
            {cards.map((card) => (
              <div key={card.id} style={styles.card}>
                <img src={card.image_url} alt={card.name} style={styles.cardImage} />
                <h3>{card.name} {card.is_popular ? '⭐' : ''}</h3>
                <p>{card.set_name} ({card.card_number})</p>
                <p><strong>Rarity:</strong> {card.rarity}</p>
                <p style={styles.price}>${Number(card.price).toFixed(2)}</p>
                <p>Stock: {card.stock_quantity}</p>
                <button 
                  disabled={card.stock_quantity < 1} 
                  onClick={() => handleBuy(card.id)}
                  style={card.stock_quantity > 0 ? styles.buyBtn : styles.disabledBtn}
                >
                  {card.stock_quantity > 0 ? 'Buy Now' : 'Out of Stock'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {tab === 'inventory' && (
        <div style={styles.grid}>
          {inventory.length === 0 ? (
            <p>No cards in inventory yet.</p>
          ) : (
            inventory.map((item) => {
              const isShipped = item.shipping_status === 'Shipped';
              return (
                <div key={item.purchase_id} style={styles.card}>
                  <img src={item.image_url} alt={item.name} style={styles.cardImage} />
                  <h3>{item.name}</h3>
                  <p>Rarity: {item.rarity}</p>
                  <p>
                    Status:{' '}
                    <span style={isShipped ? styles.badgeShipped : styles.badgeProcessing}>
                      {item.shipping_status}
                    </span>
                  </p>

                  {isShipped ? (
                    <p style={{ marginTop: '10px' }}>
                      <small>Tracking: <code>{item.tracking_number}</code></small>
                    </p>
                  ) : (
                    <button 
                      onClick={() => handleShipItem(item.purchase_id)} 
                      style={styles.shipBtn}
                    >
                      🚀 Ship This Card
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div>
          {purchases.length === 0 ? (
            <p>No purchase history found.</p>
          ) : (
            purchases.map((item) => (
              <div key={item.purchase_id} style={styles.historyRow}>
                <img src={item.image_url} alt={item.name} style={{ width: '50px', height: '70px', objectFit: 'contain' }} />
                <div style={{ flex: 1 }}>
                  <h4>{item.name}</h4>
                  <p>Paid: ${Number(item.price_at_purchase).toFixed(2)} | Date: {new Date(item.purchased_at).toLocaleDateString()}</p>
                  <p><small>Deliver To: {item.shipping_address}</small></p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={item.shipping_status === 'Shipped' ? styles.badgeShipped : styles.badgeProcessing}>
                    {item.shipping_status}
                  </span>
                  <p style={{ marginTop: '8px' }}>
                    <small>
                      {item.carrier}: <code>{item.tracking_number || 'Unassigned'}</code>
                    </small>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: '900px', margin: '20px auto', fontFamily: 'sans-serif', padding: '0 16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '12px' },
  nav: { display: 'flex', gap: '10px', margin: '20px 0' },
  tab: { padding: '8px 12px', border: '1px solid #ccc', background: '#f9f9f9', borderRadius: '4px', cursor: 'pointer' },
  activeTab: { backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' },
  card: { border: '1px solid #ccc', borderRadius: '8px', padding: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  cardImage: { width: '100%', height: '180px', objectFit: 'contain' },
  price: { fontSize: '18px', color: '#2e7d32', fontWeight: 'bold' },
  buyBtn: { backgroundColor: '#2e7d32', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', width: '100%' },
  secondaryBtn: { backgroundColor: '#757575', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' },
  disabledBtn: { backgroundColor: '#ccc', color: '#666', border: 'none', padding: '8px 16px', borderRadius: '4px', width: '100%', cursor: 'not-allowed' },
  shipBtn: { backgroundColor: '#0288d1', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', marginTop: '8px', width: '100%', fontWeight: 'bold' },
  historyRow: { display: 'flex', gap: '16px', alignItems: 'center', border: '1px solid #eee', padding: '12px', borderRadius: '8px', marginBottom: '10px' },
  badgeProcessing: { background: '#fff3e0', color: '#e65100', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgeShipped: { background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }
};