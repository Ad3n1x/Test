const mongoose = require('mongoose');
const WorkflowSchema = new mongoose.Schema({ name:{type:String,required:true,trim:true,maxlength:80}, description:{type:String,default:'',maxlength:500}, type:{type:String,enum:['Text classification','Input validation','JSON assertions'],default:'Text classification'}, status:{type:String,enum:['active','archived'],default:'active'}, tags:[String] },{timestamps:true});
module.exports = mongoose.model('Workflow',WorkflowSchema);
