import { useState, useEffect } from 'react';
import { getDbLogs, clearDbLogs } from '../lib/supabase';
import { supabase } from '../lib/supabase';

export default function Debug() {
    const [logs, setLogs] = useState([]);
    const [filter, setFilter] = useState('');
    const [session, setSession] = useState(null);
    const [profiles, setProfiles] = useState([]);
    const [rpcStatus, setRpcStatus] = useState('checking');
    const [showProfiles, setShowProfiles] = useState(false);

    useEffect(() => {
        // Get session info
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
        });

        // Check if RPC function exists
        const checkRPC = async () => {
            try {
                const { data, error } = await supabase.rpc('create_user_profile', {
                    user_id: '00000000-0000-0000-0000-000000000099',
                    user_name: 'Test',
                    user_email: 'test@example.com',
                    user_role: 'student',
                });
                
                if (error && error.message.includes('does not exist')) {
                    setRpcStatus('missing');
                } else {
                    setRpcStatus('ready');
                }
            } catch (e) {
                if (e.message?.includes('does not exist')) {
                    setRpcStatus('missing');
                } else {
                    setRpcStatus('ready');
                }
            }
        };
        
        checkRPC();

        // Fetch recent profiles
        const fetchProfiles = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error) {
                console.error('Error fetching profiles:', error);
            } else {
                setProfiles(data || []);
            }
        };

        fetchProfiles();

        // Refresh logs every 2 seconds
        const interval = setInterval(() => {
            setLogs(getDbLogs());
        }, 2000);

        setLogs(getDbLogs());
        return () => clearInterval(interval);
    }, []);

    const filteredLogs = logs.filter(
        (log) =>
            filter === '' ||
            log.operation.includes(filter) ||
            log.table.includes(filter) ||
            log.status.includes(filter)
    );

    const handleClearLogs = () => {
        clearDbLogs();
        setLogs([]);
    };

    const errorLogs = logs.filter(log => log.status === 'ERROR');
    const successLogs = logs.filter(log => log.status === 'SUCCESS');

    return (
        <div style={{ padding: '20px', backgroundColor: '#1e1e1e', color: '#e0e0e0', minHeight: '100vh' }}>
            <h1>🐛 MakerVault Debug Center</h1>

            {/* RPC Status Alert */}
            {rpcStatus === 'missing' && (
                <div style={{
                    marginBottom: '20px',
                    padding: '15px',
                    backgroundColor: '#ff6b6b',
                    color: '#fff',
                    borderRadius: '4px',
                    border: '1px solid #cc5555',
                }}>
                    <strong>⚠️ RPC Function Missing</strong>
                    <p style={{ margin: '5px 0 0 0' }}>
                        The <code>create_user_profile</code> function is not set up. 
                        Run the SQL from <code>supabase/003_create_profile_rpc.sql</code> in your Supabase SQL Editor.
                    </p>
                </div>
            )}

            {/* Session Info */}
            <section style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#2d2d2d', borderRadius: '4px', border: '1px solid #444' }}>
                <h2>👤 Current Session</h2>
                {session ? (
                    <div>
                        <p><strong>User ID:</strong> {session.user?.id}</p>
                        <p><strong>Email:</strong> {session.user?.email}</p>
                        <p><strong>Role:</strong> {session.user?.user_metadata?.role || 'N/A'}</p>
                        <p><strong>Logged in at:</strong> {new Date(session.created_at).toLocaleString()}</p>
                        <button 
                            onClick={async () => {
                                try {
                                    await supabase.auth.signOut();
                                    alert('Signed out successfully. Refresh the page.');
                                    window.location.reload();
                                } catch (err) {
                                    console.error('Force logout failed:', err);
                                    alert('Force logout failed. Try clearing browser storage.');
                                }
                            }}
                            style={{
                                marginTop: '10px',
                                padding: '8px 16px',
                                backgroundColor: '#ff6b6b',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Force Logout & Refresh
                        </button>
                    </div>
                ) : (
                    <p style={{ color: '#888' }}>Not logged in</p>
                )}
            </section>

            {/* Statistics */}
            <section style={{ marginBottom: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div style={{ padding: '15px', backgroundColor: '#2d2d2d', borderRadius: '4px', border: '1px solid #444' }}>
                    <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '12px' }}>TOTAL LOGS</p>
                    <h3 style={{ margin: 0, fontSize: '24px' }}>{logs.length}</h3>
                </div>
                <div style={{ padding: '15px', backgroundColor: '#2d2d2d', borderRadius: '4px', border: '1px solid #51cf66' }}>
                    <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '12px' }}>SUCCESSFUL OPS</p>
                    <h3 style={{ margin: 0, fontSize: '24px', color: '#51cf66' }}>{successLogs.length}</h3>
                </div>
                <div style={{ padding: '15px', backgroundColor: '#2d2d2d', borderRadius: '4px', border: '1px solid #ff6b6b' }}>
                    <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '12px' }}>FAILED OPS</p>
                    <h3 style={{ margin: 0, fontSize: '24px', color: '#ff6b6b' }}>{errorLogs.length}</h3>
                </div>
                <div style={{ padding: '15px', backgroundColor: '#2d2d2d', borderRadius: '4px', border: '1px solid #444' }}>
                    <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '12px' }}>PROFILES IN DB</p>
                    <h3 style={{ margin: 0, fontSize: '24px' }}>{profiles.length}</h3>
                </div>
                <div style={{ padding: '15px', backgroundColor: '#2d2d2d', borderRadius: '4px', border: '1px solid #444' }}>
                    <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '12px' }}>RPC STATUS</p>
                    <h3 style={{ margin: 0, fontSize: '24px', color: rpcStatus === 'ready' ? '#51cf66' : '#ff6b6b' }}>
                        {rpcStatus === 'checking' ? '⏳' : rpcStatus === 'ready' ? '✓ Ready' : '✗ Missing'}
                    </h3>
                </div>
            </section>

            {/* Recent Profiles */}
            <section style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#2d2d2d', borderRadius: '4px', border: '1px solid #444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2>👥 Recent Profiles in Database</h2>
                    <button
                        onClick={() => setShowProfiles(!showProfiles)}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#61dafb',
                            color: '#1e1e1e',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                        }}
                    >
                        {showProfiles ? 'Hide' : 'Show'}
                    </button>
                </div>

                {showProfiles && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #444' }}>
                                    <th style={{ textAlign: 'left', padding: '10px', color: '#61dafb' }}>Name</th>
                                    <th style={{ textAlign: 'left', padding: '10px', color: '#61dafb' }}>Email</th>
                                    <th style={{ textAlign: 'left', padding: '10px', color: '#61dafb' }}>Role</th>
                                    <th style={{ textAlign: 'left', padding: '10px', color: '#61dafb' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '10px', color: '#61dafb' }}>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {profiles.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '10px', textAlign: 'center', color: '#888' }}>
                                            No profiles found
                                        </td>
                                    </tr>
                                ) : (
                                    profiles.map((profile) => (
                                        <tr key={profile.id} style={{ borderBottom: '1px solid #444' }}>
                                            <td style={{ padding: '10px' }}>{profile.name}</td>
                                            <td style={{ padding: '10px', fontSize: '12px' }}>{profile.email}</td>
                                            <td style={{ padding: '10px' }}>{profile.role}</td>
                                            <td style={{ padding: '10px' }}>
                                                <span
                                                    style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '3px',
                                                        backgroundColor: profile.status === 'active' ? '#51cf66' : '#ff6b6b',
                                                        color: '#1e1e1e',
                                                        fontSize: '11px',
                                                    }}
                                                >
                                                    {profile.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px', fontSize: '12px', color: '#888' }}>
                                                {new Date(profile.created_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Logs Section */}
            <section style={{ marginBottom: '30px' }}>
                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="Filter by operation, table, or status..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{
                            padding: '8px',
                            flex: 1,
                            backgroundColor: '#2d2d2d',
                            color: '#e0e0e0',
                            border: '1px solid #444',
                            borderRadius: '4px',
                        }}
                    />
                    <button
                        onClick={handleClearLogs}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#ff6b6b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                    >
                        Clear Logs
                    </button>
                </div>

                <p style={{ fontSize: '12px', color: '#888', marginBottom: '15px' }}>
                    Showing {filteredLogs.length} of {logs.length} logs
                </p>

                <div
                    style={{
                        backgroundColor: '#2d2d2d',
                        borderRadius: '4px',
                        border: '1px solid #444',
                        maxHeight: '60vh',
                        overflowY: 'auto',
                    }}
                >
                    {filteredLogs.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                            {logs.length === 0 ? 'No logs yet. Try signing up or logging in.' : 'No logs match your filter.'}
                        </div>
                    ) : (
                        filteredLogs.map((log, idx) => (
                            <div
                                key={idx}
                                style={{
                                    padding: '12px',
                                    borderBottom: '1px solid #444',
                                    fontSize: '12px',
                                    fontFamily: 'monospace',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ color: '#61dafb' }}>
                                        [{log.timestamp}]
                                    </span>
                                    <span
                                        style={{
                                            color: log.status === 'ERROR' ? '#ff6b6b' : '#51cf66',
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        {log.status}
                                    </span>
                                </div>
                                <div style={{ color: '#ffd700', marginBottom: '4px' }}>
                                    {log.operation} → {log.table}
                                </div>
                                {Object.keys(log.details).length > 0 && (
                                    <div style={{ color: '#b0b0b0', marginBottom: '4px', wordBreak: 'break-all' }}>
                                        Details: {JSON.stringify(log.details)}
                                    </div>
                                )}
                                {log.error && (
                                    <div style={{ color: '#ff6b6b' }}>
                                        ❌ {log.error}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Help Section */}
            <section style={{ padding: '15px', backgroundColor: '#2d2d2d', borderRadius: '4px', border: '1px solid #444' }}>
                <h2>❓ Troubleshooting Guide</h2>
                <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                    <p><strong>✔️ Setup Steps:</strong></p>
                    <ol style={{ margin: '5px 0 15px 20px' }}>
                        <li>Run the SQL from <code>supabase/002_fix_signup_trigger.sql</code> in Supabase SQL Editor</li>
                        <li>Run the SQL from <code>supabase/003_create_profile_rpc.sql</code> in Supabase SQL Editor</li>
                        <li>Check this debug page - the RPC STATUS should show ✓ Ready</li>
                        <li>Test signup with a new account</li>
                    </ol>

                    <p><strong>❌ If you still see "Failed to complete profile setup":</strong></p>
                    <ul style={{ margin: '5px 0 15px 20px' }}>
                        <li>Check the browser console (F12) for the exact error message</li>
                        <li>Check this debug page's logs for failed operations</li>
                        <li>Verify RPC STATUS shows ✓ Ready</li>
                        <li>Check Supabase Dashboard → Logs tab for database errors</li>
                    </ul>

                    <p><strong>💡 How to view Supabase Logs:</strong></p>
                    <ul style={{ margin: '5px 0 15px 20px' }}>
                        <li>Supabase Dashboard → Your Project → Logs</li>
                        <li>Look for errors around your signup attempt</li>
                        <li>Check "Postgres" logs for SQL errors</li>
                    </ul>

                    <p><strong>🔍 Debug Workflow:</strong></p>
                    <ol style={{ margin: '5px 0 0 20px' }}>
                        <li>Open browser DevTools (F12) → Console tab</li>
                        <li>Try to register a new account</li>
                        <li>Check console for [AUTH] logs with detailed messages</li>
                        <li>Check this debug page for database operations</li>
                        <li>Check "Recent Profiles" to see if profile was created</li>
                        <li>If still stuck, copy the error message and check Supabase logs</li>
                    </ol>
                </div>
            </section>
        </div>
    );
}
