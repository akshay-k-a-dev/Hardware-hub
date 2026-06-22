import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { PrismaClient } from '@prisma/client';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const prisma = new PrismaClient();
const mainApp = new Hono();

mainApp.use('*', cors());
mainApp.get('/', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'HardwareHub API' }));
mainApp.get('/api', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'HardwareHub API (Subpath)' }));

const app = mainApp.basePath('/api');

// Helper functions for Snake-to-Camel conversion
function snakeToCamel(str) {
  return str.replace(/([-_][a-z])/g, group =>
    group.toUpperCase().replace('-', '').replace('_', '')
  );
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function convertKeysToCamel(obj) {
  if (Array.isArray(obj)) {
    return obj.map(v => convertKeysToCamel(v));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = snakeToCamel(key);
      result[camelKey] = convertKeysToCamel(obj[key]);
      return result;
    }, {});
  }
  return obj;
}

function convertKeysToSnake(obj) {
  if (Array.isArray(obj)) {
    return obj.map(v => convertKeysToSnake(v));
  } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = convertKeysToSnake(obj[key]);
      return result;
    }, {});
  }
  return obj;
}

// Auth Helper
async function getAuthenticatedUser(c) {
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token || !token.startsWith('jwt-session-')) {
    return null;
  }
  const userId = token.replace('jwt-session-', '');
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    include: { trustScore: true }
  });
  return profile;
}

// ─── AUTHENTICATION ROUTES ───────────────────────────────────────────────────

app.post('/auth/signup', async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    if (!email || !password || !name) {
      return c.json({ error: 'Email, password and name are required' }, 400);
    }

    const existing = await prisma.profile.findUnique({
      where: { email: email.toLowerCase() }
    });
    if (existing) {
      return c.json({ error: 'Email already registered' }, 400);
    }

    // Check institutional domain for student verification
    const domains = await prisma.institutionalDomain.findMany();
    const domainRegexes = domains.map(d =>
      new RegExp('^' + d.domainPattern.replace(/%/g, '.*').replace(/\./g, '\\.') + '$', 'i')
    );
    const isVerifiedStudent = domainRegexes.some(rx => rx.test(email));

    // Create profile
    const profile = await prisma.profile.create({
      data: {
        name,
        fullName: name,
        email: email.toLowerCase(),
        password,
        role: role || 'student',
        status: 'active',
        emailVerified: isVerifiedStudent,
        profileCompleted: false
      }
    });

    // Create initial trust score
    await prisma.trustScore.create({
      data: {
        userId: profile.id,
        score: 100,
        band: 'trusted'
      }
    });

    const token = `jwt-session-${profile.id}`;
    const session = {
      user: { id: profile.id, email: profile.email },
      access_token: token
    };

    return c.json(convertKeysToSnake({ token, session }));
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/auth/signin', async (c) => {
  try {
    const { email, password } = await c.req.json();
    const profile = await prisma.profile.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!profile || profile.password !== password) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const token = `jwt-session-${profile.id}`;
    const session = {
      user: { id: profile.id, email: profile.email },
      access_token: token
    };

    return c.json(convertKeysToSnake({ token, session }));
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/auth/update-password', async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const { password } = await c.req.json();
    const updated = await prisma.profile.update({
      where: { id: auth.id },
      data: { password }
    });
    return c.json({ user: { id: updated.id, email: updated.email } });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── DYNAMIC QUERY BUILDER GATEWAY ──────────────────────────────────────────

app.post('/query', async (c) => {
  try {
    const body = await c.req.json();
    const { table, operation, payload, filters, orders, limitValue, isSingle, countOption } = body;

    const prismaModels = {
      profiles: prisma.profile,
      hardware_items: prisma.hardwareItem,
      requests: prisma.request,
      lending_history: prisma.lendingHistory,
      prebook_queue: prisma.prebookQueue,
      trust_scores: prisma.trustScore,
      trust_events: prisma.trustEvent,
      institutional_domains: prisma.institutionalDomain,
      notifications: prisma.notification
    };

    const model = prismaModels[table];
    if (!model) {
      return c.json({ error: `Table ${table} not supported` }, 400);
    }

    // Build Where filter
    const where = {};
    if (filters && filters.length > 0) {
      for (const filter of filters) {
        const field = snakeToCamel(filter.column);
        const type = filter.type;
        const value = filter.value;

        if (type === 'eq') {
          where[field] = value;
        } else if (type === 'neq') {
          where[field] = { not: value };
        } else if (type === 'gt') {
          where[field] = { gt: value };
        } else if (type === 'gte') {
          where[field] = { gte: value };
        } else if (type === 'lt') {
          where[field] = { lt: value };
        } else if (type === 'lte') {
          where[field] = { lte: value };
        } else if (type === 'in') {
          where[field] = { in: Array.isArray(value) ? value : [value] };
        }
      }
    }

    if (operation === 'select') {
      let include = undefined;
      if (table === 'requests') {
        include = { user: true, hardware: true };
      } else if (table === 'prebook_queue') {
        include = { user: true, hardware: true };
      } else if (table === 'hardware_items') {
        include = { owner: true };
      }

      // Count option
      let totalCount = undefined;
      if (countOption) {
        totalCount = await model.count({ where });
      }

      // Query options
      const queryOptions = { where };
      if (include) queryOptions.include = include;

      // Sorting
      if (orders && orders.length > 0) {
        queryOptions.orderBy = orders.map(o => ({
          [snakeToCamel(o.column)]: o.ascending ? 'asc' : 'desc'
        }));
      }

      // Limit
      if (limitValue !== null && limitValue !== undefined) {
        queryOptions.take = limitValue;
      }

      let data = await model.findMany(queryOptions);

      // Join transformation to mimic Supabase relation shapes
      if (table === 'requests') {
        data = data.map(req => ({
          ...req,
          borrower: req.user,
          profiles: req.user,
          hardware: req.hardware,
          hardware_items: req.hardware
        }));
      } else if (table === 'prebook_queue') {
        data = data.map(pq => ({
          ...pq,
          user: pq.user,
          profiles: pq.user,
          hardware: pq.hardware,
          hardware_items: pq.hardware
        }));
      }

      if (isSingle) {
        data = data[0] || null;
      }

      return c.json(convertKeysToSnake({ data, count: totalCount }));
    }

    if (operation === 'insert') {
      const camelPayload = convertKeysToCamel(payload);
      let data;

      if (Array.isArray(camelPayload)) {
        data = await Promise.all(
          camelPayload.map(async p => {
            // Apply borrow risk gate on insert request
            if (table === 'requests') {
              const gate = await checkBorrowGate(p.userId, p.hardwareId, p.quantity);
              if (!gate.allowed) {
                throw new Error(gate.reason);
              }
            }
            return model.create({ data: p });
          })
        );
      } else {
        if (table === 'requests') {
          const gate = await checkBorrowGate(camelPayload.userId, camelPayload.hardwareId, camelPayload.quantity);
          if (!gate.allowed) {
            throw new Error(gate.reason);
          }
        }
        data = await model.create({ data: camelPayload });
      }

      return c.json(convertKeysToSnake({ data }));
    }

    if (operation === 'update') {
      const camelPayload = convertKeysToCamel(payload);
      
      // Batch update in Prisma requires updateMany
      const result = await model.updateMany({
        where,
        data: camelPayload
      });

      // Find updated records to return them (Supabase update returns matching rows)
      const data = await model.findMany({ where });
      return c.json(convertKeysToSnake({ data: isSingle ? (data[0] || null) : data }));
    }

    if (operation === 'delete') {
      await model.deleteMany({ where });
      return c.json({ data: null });
    }

    return c.json({ error: 'Unsupported operation' }, 400);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── RISK GATE HELPER ────────────────────────────────────────────────────────

async function checkBorrowGate(userId, hardwareId, quantity) {
  // 1. Check Atomic Rate Limit: Max 5 borrow requests per user per minute
  const oneMinuteAgo = new Date(Date.now() - 60000);
  const recentRequestsCount = await prisma.request.count({
    where: {
      userId,
      requestDate: { gte: oneMinuteAgo }
    }
  });

  if (recentRequestsCount >= 5) {
    return { allowed: false, reason: "Rate limit exceeded. Max 5 borrow requests per minute." };
  }

  // 2. Fetch User Profile and Trust score
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    include: { trustScore: true }
  });

  if (!profile) {
    return { allowed: false, reason: "Borrower profile not found." };
  }

  if (profile.status === 'suspended') {
    return { allowed: false, reason: "Account is suspended." };
  }

  const score = profile.trustScore ? profile.trustScore.score : 100;
  const band = profile.trustScore ? profile.trustScore.band : 'trusted';
  const totalBorrows = profile.trustScore ? profile.trustScore.totalBorrows : 0;

  // 3. Blocked Band (<40)
  if (score < 40 || band === 'blocked') {
    return { allowed: false, reason: "Account suspended due to low trust score." };
  }

  // 4. Fetch Hardware Item info
  const hw = await prisma.hardwareItem.findUnique({
    where: { id: hardwareId }
  });

  if (!hw) {
    return { allowed: false, reason: "Hardware item not found." };
  }

  // 5. Caution Band (40-69) gating
  if (score < 70 || band === 'caution') {
    if (hw.isHighValue) {
      return { allowed: false, reason: "High-value hardware cannot be borrowed with a caution rating." };
    }
  }

  // 6. Trusted Band limits
  if (score >= 70 || band === 'trusted') {
    // Brand new users (total borrows = 0) limited to 1 active high value item
    if (totalBorrows === 0 && hw.isHighValue) {
      const activeHighValueCount = await prisma.request.count({
        where: {
          userId,
          status: { in: ['pending', 'approved', 'issued', 'overdue'] },
          hardware: { isHighValue: true }
        }
      });
      if (activeHighValueCount >= 1) {
        return { allowed: false, reason: "First-time borrowers are limited to 1 active high-value item." };
      }
    }
  }

  // 7. Global Platform Limit: Max active requests <= 10
  const activeRequestsCount = await prisma.request.count({
    where: {
      userId,
      status: { in: ['pending', 'approved', 'issued', 'overdue'] }
    }
  });

  if (activeRequestsCount >= 10) {
    return { allowed: false, reason: "Maximum limit of 10 active requests reached." };
  }

  return { allowed: true };
}

// ─── RPC ENDPOINTS ──────────────────────────────────────────────────────────

app.post('/rpc/:name', async (c) => {
  const auth = await getAuthenticatedUser(c);
  const rpcName = c.req.param('name');
  
  try {
    const params = await c.req.json().catch(() => ({}));
    const p = convertKeysToCamel(params);

    // 1. can_user_borrow
    if (rpcName === 'can_user_borrow') {
      const userId = p.pUserId || (auth ? auth.id : null);
      if (!userId) return c.json({ error: 'User ID is required' }, 400);

      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        include: { trustScore: true }
      });

      if (!profile) return c.json({ data: { allowed: false, reason: 'Profile not found' } });
      if (profile.status === 'suspended') return c.json({ data: { allowed: false, reason: 'Account suspended' } });

      const overdue = await prisma.request.count({
        where: { userId, status: 'overdue' }
      });

      if (overdue > 0) {
        return c.json({ data: { allowed: false, reason: 'Please return your overdue items before borrowing.' } });
      }

      const activeCount = await prisma.request.count({
        where: { userId, status: { in: ['pending', 'approved', 'issued', 'overdue'] } }
      });

      const trust = profile.trustScore || { score: 100, band: 'trusted' };

      return c.json({
        data: {
          allowed: trust.score >= 40,
          reason: trust.score < 40 ? 'Account suspended due to low trust score' : null,
          band: trust.band,
          active_requests: activeCount
        }
      });
    }

    // 2. get_user_prebook_position
    if (rpcName === 'get_user_prebook_position') {
      const { pHardwareId, pUserId } = p;
      const prebook = await prisma.prebookQueue.findFirst({
        where: {
          hardwareId: pHardwareId,
          userId: pUserId,
          status: { in: ['waiting', 'notified'] }
        }
      });

      if (prebook) {
        return c.json({
          data: {
            in_queue: true,
            prebook_id: prebook.id,
            position: prebook.position,
            status: prebook.status,
            hold_expires_at: prebook.holdExpiresAt ? prebook.holdExpiresAt.toISOString() : null
          }
        });
      }

      return c.json({
        data: {
          in_queue: false,
          prebook_id: null,
          position: null,
          status: null,
          hold_expires_at: null
        }
      });
    }

    // 3. get_prebook_count
    if (rpcName === 'get_prebook_count') {
      const { pHardwareId } = p;
      const count = await prisma.prebookQueue.count({
        where: {
          hardwareId: pHardwareId,
          status: { in: ['waiting', 'notified'] }
        }
      });
      return c.json({ data: count });
    }

    // 4. prebook_item
    if (rpcName === 'prebook_item') {
      if (!auth) return c.json({ error: 'Unauthorized' }, 401);
      const { pHardwareId } = p;

      const count = await prisma.prebookQueue.count({
        where: { hardwareId: pHardwareId, status: { in: ['waiting', 'notified'] } }
      });

      const nextPosition = count + 1;

      const prebook = await prisma.prebookQueue.create({
        data: {
          userId: auth.id,
          hardwareId: pHardwareId,
          position: nextPosition,
          status: 'waiting'
        }
      });

      return c.json({ data: { prebook_id: prebook.id, position: nextPosition } });
    }

    // 5. cancel_prebook
    if (rpcName === 'cancel_prebook') {
      const { pPrebookId } = p;
      const prebook = await prisma.prebookQueue.findUnique({
        where: { id: pPrebookId }
      });

      if (!prebook) return c.json({ error: 'Prebooking not found' }, 404);

      await prisma.prebookQueue.update({
        where: { id: pPrebookId },
        data: {
          status: 'cancelled',
          position: 0
        }
      });

      // Shift remaining queue positions
      const remaining = await prisma.prebookQueue.findMany({
        where: {
          hardwareId: prebook.hardwareId,
          status: 'waiting',
          position: { gt: prebook.position }
        },
        orderBy: { position: 'asc' }
      });

      for (let i = 0; i < remaining.length; i++) {
        await prisma.prebookQueue.update({
          where: { id: remaining[i].id },
          data: { position: prebook.position + i }
        });
      }

      return c.json({ data: { message: 'Reservation cancelled successfully' } });
    }

    // 6. claim_prebook
    if (rpcName === 'claim_prebook') {
      const { pPrebookId } = p;
      const prebook = await prisma.prebookQueue.findUnique({
        where: { id: pPrebookId },
        include: { hardware: true }
      });

      if (!prebook) return c.json({ error: 'Prebooking not found' }, 404);

      await prisma.prebookQueue.update({
        where: { id: pPrebookId },
        data: { status: 'claimed' }
      });

      // Convert hold to Request
      const request = await prisma.request.create({
        data: {
          userId: prebook.userId,
          hardwareId: prebook.hardwareId,
          quantity: 1,
          projectTitle: 'Waitlist Claimed Item',
          projectDescription: 'Claimed via waitlist reservation hold.',
          status: 'pending'
        }
      });

      return c.json({ data: { success: true, request_id: request.id } });
    }

    // 7. get_user_profile
    if (rpcName === 'get_user_profile') {
      const { pUserId } = p;
      const profile = await prisma.profile.findUnique({
        where: { id: pUserId }
      });
      return c.json({ data: profile });
    }

    // 8. update_user_profile
    if (rpcName === 'update_user_profile') {
      const { pUserId, pName, pPhone, pRollNumber, pDepartment } = p;
      const profile = await prisma.profile.update({
        where: { id: pUserId },
        data: {
          name: pName,
          phone: pPhone,
          rollNumber: pRollNumber,
          department: pDepartment,
          profileCompleted: true
        }
      });
      return c.json({ data: profile });
    }

    // 9. get_multiple_user_ratings
    if (rpcName === 'get_multiple_user_ratings') {
      const { pUserIds } = p;
      const scores = await prisma.trustScore.findMany({
        where: { userId: { in: pUserIds } }
      });

      const data = pUserIds.map(uid => {
        const ts = scores.find(s => s.userId === uid) || { score: 100, totalBorrows: 0 };
        return {
          user_id: uid,
          average_rating: (ts.score / 20).toFixed(1),
          rating_count: ts.totalBorrows
        };
      });

      return c.json({ data });
    }

    // 10. approve_request
    if (rpcName === 'approve_request') {
      const { pRequestId } = p;
      const req = await prisma.request.update({
        where: { id: pRequestId },
        data: {
          status: 'approved',
          approvalDate: new Date()
        }
      });

      await prisma.notification.create({
        data: {
          userId: req.userId,
          title: "Request Approved",
          message: "Your borrow request has been approved by the lab supervisor.",
          type: "approval",
          referenceId: req.id
        }
      });

      return c.json({ data: req });
    }

    // 11. reject_request
    if (rpcName === 'reject_request') {
      const { pRequestId } = p;
      const req = await prisma.request.update({
        where: { id: pRequestId },
        data: { status: 'rejected' }
      });

      await prisma.notification.create({
        data: {
          userId: req.userId,
          title: "Request Rejected",
          message: "Your borrow request was rejected.",
          type: "request_update",
          referenceId: req.id
        }
      });

      return c.json({ data: req });
    }

    // 12. issue_request
    if (rpcName === 'issue_request') {
      const { pRequestId } = p;
      const req = await prisma.request.findUnique({
        where: { id: pRequestId },
        include: { hardware: true }
      });

      if (!req) return c.json({ error: 'Request not found' }, 404);

      if (req.hardware.quantityAvailable < req.quantity) {
        return c.json({ error: 'Insufficient quantity available in lab inventory.' }, 400);
      }

      // Deduct inventory
      await prisma.hardwareItem.update({
        where: { id: req.hardwareId },
        data: {
          quantityAvailable: { decrement: req.quantity }
        }
      });

      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + (req.hardware.maxLendingDays || 7));

      const updated = await prisma.request.update({
        where: { id: pRequestId },
        data: {
          status: 'issued',
          issueDate: new Date(),
          expectedReturnDate: expectedDate
        }
      });

      await prisma.lendingHistory.create({
        data: {
          requestId: req.id,
          conditionOnIssue: 'Good',
          notes: 'Standard checkout issue.'
        }
      });

      return c.json({ data: updated });
    }

    // 13. return_request
    if (rpcName === 'return_request') {
      const { pRequestId, pNotes, pCondition } = p;
      const req = await prisma.request.findUnique({
        where: { id: pRequestId },
        include: { hardware: true }
      });

      if (!req) return c.json({ error: 'Request not found' }, 404);

      // Return condition & timing penalty/rewards
      const actualReturnDate = new Date();
      const isLate = req.expectedReturnDate && actualReturnDate > req.expectedReturnDate;

      // Restock inventory
      const updatedHw = await prisma.hardwareItem.update({
        where: { id: req.hardwareId },
        data: {
          quantityAvailable: { increment: req.quantity }
        }
      });

      // Update Request status
      const updatedReq = await prisma.request.update({
        where: { id: pRequestId },
        data: {
          status: 'returned',
          actualReturnDate,
          providerNotes: pNotes
        }
      });

      // Audit lending history
      await prisma.lendingHistory.create({
        data: {
          requestId: req.id,
          conditionOnIssue: 'Good',
          conditionOnReturn: pCondition,
          notes: pNotes
        }
      });

      // Trust score modification
      let trust = await prisma.trustScore.findUnique({
        where: { userId: req.userId }
      });

      if (!trust) {
        trust = await prisma.trustScore.create({
          data: { userId: req.userId, score: 100, band: 'trusted' }
        });
      }

      let delta = 0;
      let reason = 'On-Time Return';

      if (isLate) {
        delta = -10;
        reason = 'Late Return';
      } else {
        delta = 5;
      }

      if (pCondition === 'Broken') {
        delta -= 30;
        reason = 'Damaged Item returned';
      } else if (pCondition === 'Poor') {
        delta -= 8;
        reason = 'Poor condition return';
      }

      const newScore = Math.max(0, Math.min(100, trust.score + delta));
      let newBand = 'trusted';
      if (newScore < 40) newBand = 'blocked';
      else if (newScore < 70) newBand = 'caution';

      await prisma.trustScore.update({
        where: { userId: req.userId },
        data: {
          score: newScore,
          band: newBand,
          totalBorrows: { increment: 1 },
          onTimeReturns: isLate ? undefined : { increment: 1 },
          lateReturns: isLate ? { increment: 1 } : undefined,
          damagesReported: pCondition === 'Broken' ? { increment: 1 } : undefined,
          lastUpdated: new Date()
        }
      });

      await prisma.trustEvent.create({
        data: {
          userId: req.userId,
          delta,
          reason,
          scoreAfter: newScore,
          notes: pNotes,
          requestId: req.id
        }
      });

      // Waitlist Allocation Trigger (on stock increase)
      if (updatedHw.quantityAvailable > 0) {
        const nextWaiting = await prisma.prebookQueue.findFirst({
          where: { hardwareId: req.hardwareId, status: 'waiting' },
          orderBy: { position: 'asc' }
        });

        if (nextWaiting) {
          const holdExpires = new Date();
          holdExpires.setHours(holdExpires.getHours() + 24);

          // Reserve waitlisted item
          await prisma.prebookQueue.update({
            where: { id: nextWaiting.id },
            data: {
              status: 'notified',
              notifiedAt: new Date(),
              holdExpiresAt: holdExpires,
              position: 0
            }
          });

          await prisma.hardwareItem.update({
            where: { id: req.hardwareId },
            data: { quantityAvailable: { decrement: 1 } }
          });

          // Shift positions of remaining waiting students
          const remaining = await prisma.prebookQueue.findMany({
            where: { hardwareId: req.hardwareId, status: 'waiting' },
            orderBy: { position: 'asc' }
          });

          for (let i = 0; i < remaining.length; i++) {
            await prisma.prebookQueue.update({
              where: { id: remaining[i].id },
              data: { position: i + 1 }
            });
          }

          // Create notification for waitlisted user
          await prisma.notification.create({
            data: {
              userId: nextWaiting.userId,
              title: "Hardware Available!",
              message: `An item you waitlisted (${req.hardware.name}) is now available. Claim it within 24 hours.`,
              type: "prebook",
              referenceId: nextWaiting.id
            }
          });
        }
      }

      return c.json({ data: updatedReq });
    }

    // 14. cancel_request
    if (rpcName === 'cancel_request') {
      const { pRequestId } = p;
      const req = await prisma.request.update({
        where: { id: pRequestId },
        data: { status: 'cancelled' }
      });
      return c.json({ data: req });
    }

    return c.json({ error: `Procedure ${rpcName} not found` }, 404);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── DAILY CRON ACCOUNTABILITY ──────────────────────────────────────────────

app.all('/cron/accountability', async (c) => {
  try {
    const now = new Date();
    
    // Find active issued requests that are past their expected return date
    const overdueRequests = await prisma.request.findMany({
      where: {
        status: 'issued',
        expectedReturnDate: { lt: now }
      },
      include: { user: { include: { trustScore: true } } }
    });

    let count = 0;
    for (const req of overdueRequests) {
      // Calculate overdue days
      const daysOverdue = Math.floor((now - req.expectedReturnDate) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) continue;

      // Penalize 2 points per day
      const penalty = daysOverdue * 2;
      
      const currentScore = req.user.trustScore ? req.user.trustScore.score : 100;
      const newScore = Math.max(0, currentScore - 2); // apply penalty daily (2 points per day)

      let newBand = 'trusted';
      if (newScore < 40) newBand = 'blocked';
      else if (newScore < 70) newBand = 'caution';

      await prisma.trustScore.update({
        where: { userId: req.userId },
        data: {
          score: newScore,
          band: newBand,
          lastUpdated: now
        }
      });

      // Insert trust log
      await prisma.trustEvent.create({
        data: {
          userId: req.userId,
          delta: -2,
          reason: 'Daily Overdue Penalty',
          scoreAfter: newScore,
          notes: `Item is ${daysOverdue} days overdue.`,
          requestId: req.id
        }
      });

      // Send warning notification
      await prisma.notification.create({
        data: {
          userId: req.userId,
          title: "Overdue Item Penalty",
          message: `Your borrowed item is overdue. A penalty has been applied to your trust score.`,
          type: "reminder",
          referenceId: req.id
        }
      });

      count++;
    }

    // Clean up expired pre-booking reservations (>24h)
    const expiredPrebooks = await prisma.prebookQueue.findMany({
      where: {
        status: 'notified',
        holdExpiresAt: { lt: now }
      },
      include: { hardware: true }
    });

    for (const pb of expiredPrebooks) {
      // Mark expired
      await prisma.prebookQueue.update({
        where: { id: pb.id },
        data: { status: 'expired' }
      });

      // Restock the reserved unit
      const updatedHw = await prisma.hardwareItem.update({
        where: { id: pb.hardwareId },
        data: { quantityAvailable: { increment: 1 } }
      });

      // Send expired notification
      await prisma.notification.create({
        data: {
          userId: pb.userId,
          title: "Reservation Expired",
          message: `Your hold reservation for ${pb.hardware.name} has expired.`,
          type: "prebook",
          referenceId: pb.id
        }
      });

      // Reallocate immediately to next student in line
      if (updatedHw.quantityAvailable > 0) {
        const nextWaiting = await prisma.prebookQueue.findFirst({
          where: { hardwareId: pb.hardwareId, status: 'waiting' },
          orderBy: { position: 'asc' }
        });

        if (nextWaiting) {
          const holdExpires = new Date();
          holdExpires.setHours(holdExpires.getHours() + 24);

          await prisma.prebookQueue.update({
            where: { id: nextWaiting.id },
            data: {
              status: 'notified',
              notifiedAt: now,
              holdExpiresAt: holdExpires,
              position: 0
            }
          });

          await prisma.hardwareItem.update({
            where: { id: pb.hardwareId },
            data: { quantityAvailable: { decrement: 1 } }
          });

          // Shift positions of remaining waiting students
          const remaining = await prisma.prebookQueue.findMany({
            where: { hardwareId: pb.hardwareId, status: 'waiting' },
            orderBy: { position: 'asc' }
          });

          for (let i = 0; i < remaining.length; i++) {
            await prisma.prebookQueue.update({
              where: { id: remaining[i].id },
              data: { position: i + 1 }
            });
          }
        }
      }
    }

    return c.json({ success: true, processedOverdueCount: count, expiredPrebooksCount: expiredPrebooks.length });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// Run standalone Node dev server on port 3000 if not in production/vercel
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  import('@hono/node-server').then(({ serve }) => {
    serve({
      fetch: mainApp.fetch,
      port: 3002
    });
    console.log('Backend server running on http://localhost:3002');
  });
}

export const GET = handle(mainApp);
export const POST = handle(mainApp);
export const PUT = handle(mainApp);
export const DELETE = handle(mainApp);
