const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { z } = require('zod');
const Workflow = require('./models/Workflow');
const TestCase = require('./models/TestCase');
const TestRun = require('./models/TestRun');
const TestResult = require('./models/TestResult');

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) { if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return cb(null, true); return cb(new Error('Origin is not allowed by CORS')); } }));
app.use(express.json({ limit: '100kb' }));
const caseSchema = z.object({ id: z.string().optional(), name: z.string().min(1).max(120), input: z.string().max(2000), expected: z.enum(['positive','negative','neutral']), enabled: z.boolean().optional() });
const runSchema = z.object({ cases: z.array(caseSchema).min(1).max(250) });
const workflowSchema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().max(500).optional(), type: z.enum(['Text classification','Input validation','JSON assertions']).default('Text classification') });
const positives = ['love','great','excellent','useful','fast','happy','good','thank','amazing','wonderful','like','perfect','helpful'];
const negatives = ['hate','terrible','awful','frustrating','bad','slow','broken','poor','angry','worse','worst','annoying','failed'];
function classify(input) { const text = String(input || '').toLowerCase(); const p = positives.filter(w => text.includes(w)).length; const n = negatives.filter(w => text.includes(w)).length; return n >= p && n > 0 ? 'negative' : p > n ? 'positive' : 'neutral'; }
function evaluate(test) { const started = process.hrtime.bigint(); const actual = classify(test.input); return { testCaseId: test._id || undefined, caseKey: test.id || String(test._id || ''), name: test.name, input: test.input, expected: test.expected, actual, status: actual === test.expected ? 'passed' : 'failed', durationMs: Number(process.hrtime.bigint() - started) / 1e6, error: actual === test.expected ? null : `Expected ${test.expected}; received ${actual}.` }; }
function dbReady() { return mongoose.connection.readyState === 1; }
app.get('/api/health', (_req,res) => res.json({ success:true, service:'signal-api', database:dbReady()?'connected':'not-configured', timestamp:new Date().toISOString() }));
app.get('/api/workflows', async (_req,res,next) => { try { if (!dbReady()) return res.status(503).json({ message:'MongoDB persistence is not configured. Use the explicitly labelled local demo workspace.' }); res.json(await Workflow.find().sort({updatedAt:-1}).limit(100).lean()); } catch(e){next(e)} });
app.post('/api/workflows', async (req,res,next) => { try { const parsed=workflowSchema.safeParse(req.body); if(!parsed.success)return res.status(400).json({message:'Invalid workflow',errors:parsed.error.issues}); if(!dbReady())return res.status(503).json({message:'MongoDB persistence is not configured.'}); const workflow=await Workflow.create(parsed.data); res.status(201).json(workflow); }catch(e){next(e)} });
app.post('/api/workflows/:id/run', async (req,res,next) => { try { const parsed=runSchema.safeParse(req.body); if(!parsed.success)return res.status(400).json({message:'Invalid run payload',errors:parsed.error.issues}); const startedAt=new Date(); const results=parsed.data.cases.filter(c=>c.enabled!==false).map(evaluate); const completedAt=new Date(); const passed=results.filter(r=>r.status==='passed').length; const failed=results.length-passed; if(!dbReady())return res.json({persisted:false,run:{id:`LOCAL-${Date.now()}`,status:failed?'failed':'passed',total:results.length,passed,failed,startedAt,completedAt,durationMs:completedAt-startedAt},results}); let workflow=req.params.id==='demo'?null:await Workflow.findById(req.params.id); if(!workflow && req.params.id!=='demo')return res.status(404).json({message:'Workflow not found'}); const run=await TestRun.create({workflow:workflow?workflow._id:undefined,status:failed?'failed':'passed',total:results.length,passed,failed,startedAt,completedAt,durationMs:completedAt-startedAt}); await TestResult.insertMany(results.map(r=>({...r,run:run._id,workflow:workflow?workflow._id:undefined}))); res.status(201).json({persisted:true,run,results}); }catch(e){next(e)} });
app.get('/api/runs', async (req,res,next) => { try { if(!dbReady())return res.status(503).json({message:'MongoDB persistence is not configured.'}); const limit=Math.min(100,Math.max(1,Number(req.query.limit)||25)); res.json(await TestRun.find().sort({createdAt:-1}).limit(limit).populate('workflow','name').lean()); }catch(e){next(e)} });
app.get('/api/runs/:id', async (req,res,next) => { try { if(!dbReady())return res.status(503).json({message:'MongoDB persistence is not configured.'}); const run=await TestRun.findById(req.params.id).populate('workflow','name').lean(); if(!run)return res.status(404).json({message:'Run not found'}); const results=await TestResult.find({run:run._id}).lean(); res.json({run,results}); }catch(e){next(e)} });

const dns = require('node:dns').promises;
const net = require('node:net');

function isPrivateAddress(address) {
  const ip = String(address || '').toLowerCase().split('%')[0];
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      parts[0] >= 224;
  }
  if (net.isIPv6(ip)) {
    return ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') ||
      /^fe[89ab]/.test(ip) || ip.startsWith('::ffff:127.') || ip.startsWith('::ffff:10.') ||
      ip.startsWith('::ffff:192.168.') || ip.startsWith('::ffff:169.254.');
  }
  return true;
}

async function validatePublicUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Enter a valid website URL, including https://'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http:// and https:// URLs are supported.');
  if (url.username || url.password) throw new Error('URLs containing usernames or passwords are not allowed.');
  if (!url.hostname || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) {
    throw new Error('Use a publicly accessible domain, not localhost or a local network address.');
  }
  const literal = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  if (net.isIP(literal)) addresses = [{ address: literal }];
  else {
    try { addresses = await dns.lookup(url.hostname, { all: true, verbatim: true }); }
    catch { throw new Error('The domain could not be resolved. Check the spelling and DNS settings.'); }
  }
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) {
    throw new Error('For safety, Signal only checks domains that resolve to public IP addresses.');
  }
  return url;
}

app.post('/api/site-checks', async (req, res) => {
  const inputSchema = z.object({ url: z.string().trim().min(1).max(2048), expectedText: z.string().max(200).optional() });
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid URL to test.', errors: parsed.error.issues });
  let current;
  try { current = await validatePublicUrl(parsed.data.url); }
  catch (error) { return res.status(400).json({ message: error.message }); }

  const started = Date.now();
  let response;
  let redirects = 0;
  try {
    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        response = await fetch(current, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { 'user-agent': 'SignalWebsiteCheck/1.0' } });
      } finally { clearTimeout(timer); }
      if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get('location')) {
        if (redirects >= 3) { await response.body?.cancel(); throw new Error('The website redirected too many times.'); }
        const nextUrl = new URL(response.headers.get('location'), current);
        await response.body?.cancel();
        current = await validatePublicUrl(nextUrl.href);
        redirects++;
        continue;
      }
      break;
    }
    const durationMs = Date.now() - started;
    const status = response.status;
    const contentType = response.headers.get('content-type') || 'unknown';
    let body = '';
    if (response.body && /text\/|json|xml|javascript/i.test(contentType)) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      while (bytes < 65536) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value.slice(0, 65536 - bytes);
        bytes += chunk.length;
        body += decoder.decode(chunk, { stream: true });
        if (bytes >= 65536) { await reader.cancel(); break; }
      }
    } else { await response.body?.cancel(); }
    const expectedText = (parsed.data.expectedText || '').trim();
    const contentMatched = expectedText ? body.toLowerCase().includes(expectedText.toLowerCase()) : null;
    res.json({
      success: true,
      url: parsed.data.url,
      finalUrl: current.href,
      status,
      statusText: response.statusText,
      reachable: status >= 200 && status < 500,
      ok: response.ok,
      durationMs,
      https: current.protocol === 'https:',
      contentType,
      redirects,
      expectedText: expectedText || null,
      contentMatched,
      checks: [
        { name: 'Website reachable', passed: status >= 200 && status < 500, detail: status >= 200 && status < 500 ? 'Received an HTTP response.' : 'The server returned an error status.' },
        { name: 'HTTP response', passed: response.ok, detail: 'HTTP ' + status + (response.statusText ? ' ' + response.statusText : '') },
        { name: 'HTTPS', passed: current.protocol === 'https:', detail: current.protocol === 'https:' ? 'Secure HTTPS URL.' : 'This URL uses HTTP, not HTTPS.' },
        ...(expectedText ? [{ name: 'Expected text', passed: contentMatched, detail: contentMatched ? 'Text was found in the first 64 KB of the response.' : 'Text was not found in the first 64 KB of the response.' }] : [])
      ]
    });
  } catch (error) {
    const timeout = error.name === 'AbortError';
    res.status(502).json({ message: timeout ? 'The website took longer than 8 seconds to respond.' : (error.message || 'Signal could not reach this website.'), durationMs: Date.now() - started });
  }
});

app.use((err,_req,res,_next)=>{console.error(err.message);res.status(500).json({message:'Unexpected server error. Check the API logs for details.'})});
module.exports=app;
