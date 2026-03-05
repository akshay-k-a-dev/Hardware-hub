import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// Database Operation Logging
// ============================================================

// Log helper function
const logDbOperation = (operation, table, details, result, error = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    operation,
    table,
    details,
    status: error ? 'ERROR' : 'SUCCESS',
    error: error?.message || null,
  };

  if (error) {
    console.error(`[DB] ${timestamp} ${operation} ${table}:`, logEntry);
  } else {
    console.log(`[DB] ${timestamp} ${operation} ${table}:`, logEntry);
  }

  // Also log to localStorage for debugging
  try {
    const logs = JSON.parse(localStorage.getItem('db_logs') || '[]');
    logs.push(logEntry);
    // Keep only last 100 logs
    if (logs.length > 100) logs.shift();
    localStorage.setItem('db_logs', JSON.stringify(logs));
  } catch (e) {
    // Silent fail for localStorage
  }

  return logEntry;
};

// Wrap query method to log operations
const originalFrom = supabase.from.bind(supabase);
supabase.from = function (table) {
  const query = originalFrom(table);

  // Wrap select
  const originalSelect = query.select.bind(query);
  query.select = function (...args) {
    const selectQuery = originalSelect(...args);
    const originalThen = selectQuery.then.bind(selectQuery);
    selectQuery.then = function (onFulfilled, onRejected) {
      return originalThen(
        (result) => {
          logDbOperation('SELECT', table, { columns: args[0] }, result);
          return onFulfilled?.(result) ?? result;
        },
        (error) => {
          logDbOperation('SELECT', table, { columns: args[0] }, null, error);
          return onRejected?.(error) ?? Promise.reject(error);
        }
      );
    };
    return selectQuery;
  };

  // Wrap insert
  const originalInsert = query.insert.bind(query);
  query.insert = function (values) {
    const insertQuery = originalInsert(values);
    const originalThen = insertQuery.then.bind(insertQuery);
    insertQuery.then = function (onFulfilled, onRejected) {
      return originalThen(
        (result) => {
          logDbOperation('INSERT', table, { rows: Array.isArray(values) ? values.length : 1 }, result);
          return onFulfilled?.(result) ?? result;
        },
        (error) => {
          logDbOperation('INSERT', table, { rows: Array.isArray(values) ? values.length : 1 }, null, error);
          return onRejected?.(error) ?? Promise.reject(error);
        }
      );
    };
    return insertQuery;
  };

  // Wrap update
  const originalUpdate = query.update.bind(query);
  query.update = function (values) {
    const updateQuery = originalUpdate(values);
    const originalThen = updateQuery.then.bind(updateQuery);
    updateQuery.then = function (onFulfilled, onRejected) {
      return originalThen(
        (result) => {
          logDbOperation('UPDATE', table, { fields: Object.keys(values) }, result);
          return onFulfilled?.(result) ?? result;
        },
        (error) => {
          logDbOperation('UPDATE', table, { fields: Object.keys(values) }, null, error);
          return onRejected?.(error) ?? Promise.reject(error);
        }
      );
    };
    return updateQuery;
  };

  // Wrap delete
  const originalDelete = query.delete.bind(query);
  query.delete = function () {
    const deleteQuery = originalDelete();
    const originalThen = deleteQuery.then.bind(deleteQuery);
    deleteQuery.then = function (onFulfilled, onRejected) {
      return originalThen(
        (result) => {
          logDbOperation('DELETE', table, {}, result);
          return onFulfilled?.(result) ?? result;
        },
        (error) => {
          logDbOperation('DELETE', table, {}, null, error);
          return onRejected?.(error) ?? Promise.reject(error);
        }
      );
    };
    return deleteQuery;
  };

  return query;
};

// Log auth operations
const originalSignUp = supabase.auth.signUp.bind(supabase.auth);
supabase.auth.signUp = async function (credentials) {
  console.log('[AUTH] SignUp attempt:', { email: credentials.email });
  try {
    const result = await originalSignUp(credentials);
    if (result.error) {
      logDbOperation('AUTH_SIGNUP', 'auth.users', { email: credentials.email }, null, result.error);
    } else {
      logDbOperation('AUTH_SIGNUP', 'auth.users', { email: credentials.email }, result);
    }
    return result;
  } catch (error) {
    logDbOperation('AUTH_SIGNUP', 'auth.users', { email: credentials.email }, null, error);
    throw error;
  }
};

const originalSignInWithPassword = supabase.auth.signInWithPassword.bind(supabase.auth);
supabase.auth.signInWithPassword = async function (credentials) {
  console.log('[AUTH] SignIn attempt:', { email: credentials.email });
  try {
    const result = await originalSignInWithPassword(credentials);
    if (result.error) {
      logDbOperation('AUTH_SIGNIN', 'auth.users', { email: credentials.email }, null, result.error);
    } else {
      logDbOperation('AUTH_SIGNIN', 'auth.users', { email: credentials.email }, result);
    }
    return result;
  } catch (error) {
    logDbOperation('AUTH_SIGNIN', 'auth.users', { email: credentials.email }, null, error);
    throw error;
  }
};

// Export logging utility
export const getDbLogs = () => {
  try {
    return JSON.parse(localStorage.getItem('db_logs') || '[]');
  } catch {
    return [];
  }
};

export const clearDbLogs = () => {
  localStorage.removeItem('db_logs');
  console.log('[DB] Logs cleared');
};
