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
app.use((err,_req,res,_next)=>{console.error(err.message);res.status(500).json({message:'Unexpected server error. Check the API logs for details.'})});
module.exports=app;
