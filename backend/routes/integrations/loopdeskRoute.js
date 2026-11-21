/**
 * Loopdesk hub → Korvo (bundle rule 2: a bundle client's Korvo is set up by
 * Loopdesk, not by hand in the Super Admin panel). Mounted in app.js under
 * /api/v1/hub/loopdesk:
 *
 *   POST /provision   make (or update, or pause) the client's company and its
 *                     owner admin. Same body every Loopdesk tool gets:
 *                     { hubBusinessId, active, business{name,country,phone}, owner{name,email,phone}, tools[] }
 *                     → { accountId, status: "ACTIVE"|"PAUSED", data{ companyId, companyCode, companyName } }
 *   POST /sso         { token } → the owner's Korvo session ({ user, roleSpecificData, token },
 *                     the same answer as /api/v1/auth/login). No password.
 *
 * Tokens: HS256 JWT signed with LOOPDESK_HUB_SECRET (the same value as
 * HUB_SECRET_KORVO on the Loopdesk server, 32+ characters):
 *   iss "regulars-hub"  aud "korvo"  sub <Loopdesk business id>  purpose "provision" | "sso"  jti  ≤ 2 minutes, single use.
 * (HUB_SECRET on this server stays the Loyvexa link's secret: routes/integrations/loyvexaRoute.js.)
 */
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Company from '../../models/company/companyModel.js';
import User from '../../models/user/userModel.js';
import { userSession } from '../../controllres/authController.js';

export const loopdesk = express.Router();

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, error: message, ...extra });
const seen = new Map();

function verify(req, token, purpose) {
  const secret = process.env.LOOPDESK_HUB_SECRET || '';
  if (secret.length < 32) { const e = new Error('LOOPDESK_HUB_SECRET is not set on Korvo'); e.status = 503; throw e; }
  let claims;
  try {
    claims = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'regulars-hub', audience: 'korvo', maxAge: '3m' });
  } catch (err) {
    const e = new Error(`Hub token rejected: ${err.message}`); e.status = 401; throw e;
  }
  if (claims.purpose !== purpose || !claims.jti || !claims.sub) { const e = new Error('Wrong hub token'); e.status = 401; throw e; }
  const now = Date.now();
  for (const [k, until] of seen) if (until < now) seen.delete(k);
  if (seen.has(claims.jti)) { const e = new Error('Hub token was already used'); e.status = 401; throw e; }
  seen.set(claims.jti, claims.exp * 1000);
  return claims;
}

const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const digits = (s) => String(s || '').replace(/\D/g, '');
const COUNTRY = { IN: 'India', CA: 'Canada' };

/** "Sharma Auto Parts" → "SHAR" + 3 digits, not used by any company yet. */
async function freeCompanyCode(name) {
  const stem = (String(name).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'LD').slice(0, 4);
  for (let i = 0; i < 20; i++) {
    const code = `${stem}${crypto.randomInt(100, 1000)}`;
    if (!(await Company.exists({ companyCode: code }))) return code;
  }
  return `LD${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/** The owner's email / mobile if no company uses them yet, else a placeholder only this company has. */
async function companyContact(b, hubId) {
  const email = String(b.owner?.email || '').trim().toLowerCase();
  const mobile = digits(b.business?.phone || b.owner?.phone);
  const emailFree = email && !(await Company.exists({ companyEmail: email }));
  const mobileFree = mobile.length >= 10 && !(await Company.exists({ companyMobile: mobile }));
  return {
    companyEmail: emailFree ? email : `korvo+${hubId}@hub.loopdeskai.invalid`.toLowerCase(),
    companyMobile: mobileFree ? mobile : `HUB-${hubId}`,
  };
}

/**
 * The owner admin. Always a Korvo login made by Loopdesk for this company:
 * an existing Korvo admin with the same email is never linked, because
 * Loopdesk SSO would then hand the bundle client that admin's whole session
 * (all their other companies). The owner's email is used for the new login
 * only if nobody in Korvo has it yet; otherwise a placeholder is used.
 * New owners get a random password (Loopdesk signs them in).
 */
async function ownerAdmin(company, b, hubId) {
  const email = String(b.owner?.email || '').trim().toLowerCase();
  const link = { companyId: company._id, role: 'admin', isActive: true, assignedAt: new Date() };

  let user = company.hub?.ownerUserId ? await User.findById(company.hub.ownerUserId) : null;
  if (user) {
    if (!user.companies.some((c) => String(c.companyId) === String(company._id))) {
      user.companies.push(link);
      if (!user.defaultCompany) user.defaultCompany = company._id;
      await user.save();
    }
  } else {
    const emailTaken = !email || await User.exists({ email });
    const mobile = digits(b.owner?.phone);
    const mobileTaken = mobile.length < 10 || await User.exists({ mobile });
    user = await User.create({
      name: b.owner?.name || b.business?.name || 'Owner',
      email: emailTaken ? `owner+${hubId}@hub.loopdeskai.invalid`.toLowerCase() : email,
      mobile: mobileTaken ? `HUB-${hubId}` : mobile,
      password: await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 10),
      role: 'admin',
      defaultCompany: company._id,
      companies: [link],
      hierarchy: { level: 1 },
    });
  }
  if (!company.assignedAdmins?.some((a) => String(a.adminId) === String(user._id))) {
    await Company.updateOne({ _id: company._id }, { $push: { assignedAdmins: { adminId: user._id, isActive: true } } });
  }
  return user;
}

loopdesk.post('/provision', async (req, res) => {
  try {
    const claims = verify(req, bearer(req), 'provision');
    const b = req.body || {};
    const hubId = String(b.hubBusinessId || '');
    if (!hubId || hubId !== claims.sub) return fail(res, 401, 'Token is for a different business');
    if (!b.business?.name) return fail(res, 400, 'business.name is required');
    const active = b.active !== false;

    let company = await Company.findOne({ 'hub.businessId': hubId });
    if (!company && !active) return res.json({ accountId: `pending-${hubId}`, status: 'PAUSED', data: {} });

    if (!company) {
      company = await Company.create({
        companyName: b.business.name,
        companyCode: await freeCompanyCode(b.business.name),
        ...(await companyContact(b, hubId)),
        companyState: b.business.state || '-',
        companyCountry: COUNTRY[b.business.country] || b.business.country || 'India',
        maxUser: 50,
        hub: { businessId: hubId },
      });
    }

    const user = await ownerAdmin(company, b, hubId);
    company.set('hub.businessId', hubId);
    company.set('hub.ownerUserId', user._id);
    company.set('hub.pausedAt', active ? undefined : (company.hub?.pausedAt || new Date()));
    company.isActive = active;
    await company.save();

    return res.json({
      accountId: String(company._id),
      status: active ? 'ACTIVE' : 'PAUSED',
      data: { companyId: String(company._id), companyCode: company.companyCode, companyName: company.companyName },
    });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.message);
    console.error('loopdesk provision error', e);
    return fail(res, 500, e.code === 11000 ? `Duplicate value: ${Object.keys(e.keyValue || {}).join(', ')}` : 'Server error');
  }
});

loopdesk.post('/sso', async (req, res) => {
  try {
    const claims = verify(req, String(req.body?.token || ''), 'sso');
    const company = await Company.findOne({ 'hub.businessId': claims.sub });
    if (!company || (claims.acct && claims.acct !== String(company._id))) return fail(res, 404, 'Korvo company not found for this business');
    if (!company.isActive) return fail(res, 403, 'Korvo is paused for this business. Renew the bundle in Loopdesk.');
    if (!company.hub?.ownerUserId) return fail(res, 409, 'Korvo is still being set up. Try again in a minute.');
    const user = await User.findById(company.hub.ownerUserId).select('isActive role');
    if (!user || user.isActive === false) return fail(res, 403, 'The owner login is switched off in Korvo');
    if (user.role !== 'admin') return fail(res, 403, 'Only the owner admin can be opened from Loopdesk');
    // Open this company first, even if the admin has others.
    await User.updateOne({ _id: user._id }, { $set: { defaultCompany: company._id } });
    const data = await userSession(user._id);
    return res.json({ success: true, message: 'Signed in from Loopdesk', data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.message);
    console.error('loopdesk sso error', e);
    return fail(res, 500, 'Server error');
  }
});
