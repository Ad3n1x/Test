const mongoose = require('mongoose');
const TestRunSchema = new mongoose.Schema({ workflow:{type:mongoose.Schema.Types.ObjectId,ref:'Workflow'}, status:{type:String,enum:['queued','running','passed','failed','error'],required:true}, total:{type:Number,default:0,min:0}, passed:{type:Number,default:0,min:0}, failed:{type:Number,default:0,min:0}, startedAt:{type:Date,default:Date.now}, completedAt:Date, durationMs:{type:Number,default:0,min:0}, trigger:{type:String,default:'manual'}, commit:{type:String,default:''} },{timestamps:true});
TestRunSchema.index({workflow:1,createdAt:-1});
module.exports = mongoose.model('TestRun',TestRunSchema);
