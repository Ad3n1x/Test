const mongoose = require('mongoose');
const TestCaseSchema = new mongoose.Schema({ workflow:{type:mongoose.Schema.Types.ObjectId,ref:'Workflow',required:true,index:true}, name:{type:String,required:true,trim:true,maxlength:120}, description:{type:String,default:'',maxlength:500}, input:{type:String,default:'',maxlength:2000}, expected:{type:String,enum:['positive','negative','neutral'],required:true}, tags:[String], enabled:{type:Boolean,default:true} },{timestamps:true});
module.exports = mongoose.model('TestCase',TestCaseSchema);
