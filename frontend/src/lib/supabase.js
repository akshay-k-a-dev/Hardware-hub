class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.operation = 'select'; // default
    this.payload = null;
    this.filters = [];
    this.orders = [];
    this.limitValue = null;
    this.isSingle = false;
    this.countOption = null;
  }

  select(columns = '*', options = {}) {
    this.operation = 'select';
    this.columns = columns;
    if (options.count) {
      this.countOption = options.count;
    }
    return this;
  }

  insert(payload) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, type: 'eq', value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ column, type: 'neq', value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ column, type: 'gt', value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ column, type: 'gte', value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ column, type: 'lt', value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ column, type: 'lte', value });
    return this;
  }

  in(column, value) {
    this.filters.push({ column, type: 'in', value });
    return this;
  }

  order(column, options = {}) {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  // Support thenable structure (promise chaining / await)
  async then(onfulfilled, onrejected) {
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hw_token') || ''}`
        },
        body: JSON.stringify({
          table: this.table,
          operation: this.operation,
          payload: this.payload,
          filters: this.filters,
          orders: this.orders,
          limitValue: this.limitValue,
          isSingle: this.isSingle,
          countOption: this.countOption
        })
      });

      const json = await res.json();
      if (!res.ok) {
        const errObj = { message: json.error || 'Request failed' };
        if (onfulfilled) return onfulfilled({ data: null, error: errObj });
        throw errObj;
      }
      
      const responsePayload = { data: json.data, error: null, count: json.count };
      if (onfulfilled) return onfulfilled(responsePayload);
      return responsePayload;
    } catch (err) {
      const errObj = { message: err.message || 'Request failed' };
      if (onfulfilled) return onfulfilled({ data: null, error: errObj });
      throw errObj;
    }
  }
}

const authListeners = new Set();

export const supabase = {
  auth: {
    signUp: async ({ email, password, options }) => {
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            name: options?.data?.name,
            role: options?.data?.role
          })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Signup failed');

        localStorage.setItem('hw_token', json.token);
        localStorage.setItem('hw_session', JSON.stringify(json.session));

        authListeners.forEach(cb => cb('SIGNED_IN', json.session));

        return { data: { user: json.session.user, session: json.session }, error: null };
      } catch (err) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    signInWithPassword: async ({ email, password }) => {
      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Signin failed');

        localStorage.setItem('hw_token', json.token);
        localStorage.setItem('hw_session', JSON.stringify(json.session));

        authListeners.forEach(cb => cb('SIGNED_IN', json.session));

        return { data: { user: json.session.user, session: json.session }, error: null };
      } catch (err) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    signOut: async () => {
      try {
        localStorage.removeItem('hw_token');
        localStorage.removeItem('hw_session');
        authListeners.forEach(cb => cb('SIGNED_OUT', null));
        return { error: null };
      } catch (err) {
        return { error: err };
      }
    },

    getSession: async () => {
      try {
        const sessionStr = localStorage.getItem('hw_session');
        if (!sessionStr) return { data: { session: null }, error: null };
        const session = JSON.parse(sessionStr);
        return { data: { session }, error: null };
      } catch (err) {
        return { data: { session: null }, error: err };
      }
    },

    onAuthStateChange: (callback) => {
      authListeners.add(callback);
      const sessionStr = localStorage.getItem('hw_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            }
          }
        }
      };
    },

    updateUser: async ({ password }) => {
      try {
        const res = await fetch('/api/auth/update-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('hw_token') || ''}`
          },
          body: JSON.stringify({ password })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Update password failed');
        return { data: { user: json.user }, error: null };
      } catch (err) {
        return { data: { user: null }, error: err };
      }
    },

    resetPasswordForEmail: async (email, options) => {
      return { data: {}, error: null };
    }
  },

  from(table) {
    return new QueryBuilder(table);
  },

  channel(name) {
    return {
      on(event, filter, callback) {
        return this;
      },
      subscribe() {
        return this;
      }
    };
  },

  removeChannel(channel) {
    // no-op
  },

  rpc: async (fnName, params) => {
    try {
      const res = await fetch(`/api/rpc/${fnName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hw_token') || ''}`
        },
        body: JSON.stringify(params)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'RPC call failed');
      return { data: json.data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }
};

export const getDbLogs = () => {
  return [];
};

export const clearDbLogs = () => {};
