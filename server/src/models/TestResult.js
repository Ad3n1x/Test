const mongoose = require('mongoose');
const TestResultSchema = new mongoose.Schema({ run:{type:mongoose.Schema.Types.ObjectId,ref:'TestRun',required:true,index:true}, workflow:{type:mongoose.Schema.Types.ObjectId,ref:'Workflow'}, testCaseId:{type:mongoose.Schema.Types.ObjectId,ref:'TestCase'}, caseKey:{type:String,default:''}, name:{type:String,required:true}, input:{type:String,default:''}, expected:{type:String,required:true}, actual:{type:String,default:''}, status:{type:String,enum:['passed','failed','skipped','error'],required:true}, durationMs:{type:Number,default:0}, error:{type:String,default:null} },{timestamps:true});
TestResultSchema.index({workflow:1,caseKey:1,createdAt:-1});
module.exports = mongoose.model('TestResult',TestResultSchema);
