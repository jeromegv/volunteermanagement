$(document).ready(function() {


  $('.datepicker').datepicker();
  //TODO better way of loading tags, so far just a pre populated list, ideally we might want to save from all JDs
  $('#skills').select2({
  	tags:["Management","Business","Sales ","Marketing","Communication","Microsoft Office","Customer Service","Training","Microsoft Excel","Project Management","Designs","Analysis","Research","Websites","Budgets","Organization","Leadership","Time Management","Project Planning","Computer Program","Strategic Planning","Business Services","Applications","Reports","Microsoft Word","Program Management","Powerpoint","Negotation","Software","Networking","Offices","English","Data","Education","Events","International","Testing","Writing","Vendors","Advertising","Databases","Technology","Finance","Retail","accounting","social media","Teaching","Engineering","Performance Tuning","Problem Solving","Marketing Strategy","Materials","Recruiting","Order Fulfillment","Corporate Law","Photoshop","New business development","Human resources","Public speaking","Manufacturing","Internal Audit","strategy","Employees","Cost","Business Development","Windows","Public Relations","Product Development","Auditing","Business Strategy","Presentations","Construction","Real Estate","Editing","Sales Management","Team Building","Healthcare","Revenue","Compliance","Legal","Innovation","Policy","Mentoring","Commercial Real Estate","Consulting","Information Technology","Process Improvement","Change management","Heavy Equipment","Teamwork","Promotions","Facilities Management"],
  	tokenSeparators: [","]
  });

});
