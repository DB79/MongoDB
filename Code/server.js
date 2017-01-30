const express = require("express");
const path = require('path');
const app = express();
const bodyParser = require('body-parser');

const mongo = require('mongodb');
const MongoClient = require("mongodb").MongoClient
  , assert = require('assert');

app.set('views','./views');
app.set('view engine','ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


//var xClicksValue=0;
//var yClicksValue=0;
var globalDocs;

app.listen(3000, function() {
	
	var url = 'mongodb://localhost:27017/clicks';

	MongoClient.connect(url, (err, database) => {
		if (err) return console.log(err)
		db = database
		collection = db.collection('clicks');
		console.log("connected to clicks");

	    //create index for x_pos and Y_pos to speed up the retrieval of documents
	    collection.ensureIndex( { x_pos : 1 , y_pos: 1}, (err, result)=> {
	      if(err) console.log(err);

	      console.log("Index " + result + " created.");
	    });

	});
	console.log('listening on port 3000');
});

var router = express.Router();
app.use('/clicks', router);

router.use((req, res, next)=>{
      next();
});

var route = router.route('/');

//get all documents and send to Game page
route.get((req,res,next)=>{
	
		res.render("Game",{title:"Clicks"})
		
});

//add new clicks to database
route.post((request, result, next)=>{

	var date = new Date().toJSON().slice(0,10);
	var time = new Date().timeNow();
	//new object with date and time of new click
	var clickData = {clickDate: date, clickTime: time}
	var xPosition = request.body.x_pos;
	var yPosition = request.body.y_pos;
	var clickDataArray = [];	
	
	//try to find a dcoument that has same x and y co-ordinates, this search is indexed to speed it up
	collection.findOne( { x_pos : xPosition, y_pos : yPosition },(req,doc)=>{
		//if no match add new document to database
		if(doc == null){
			clickDataArray.push(clickData);
			var newClickObject = {
				x_pos: xPosition,
				y_pos: yPosition,
				clicks: clickDataArray
			}
			collection.insert(newClickObject, (err, res) => {
			    if (err) return console.log(err)
			    console.log("add new doc");
	    	});
		}
		else{//if there is a match, add the click data and time to existing array
				collection.update({_id: doc._id}, {$push: {"clicks": clickData}}, (err, res)=>{
					if(err) console.log(err);
					console.log("update existing doc");
				});
		}
	});  
});

var dataRoute = router.route('/stats')

dataRoute.get((req,res)=>{
	
	//execute map reduce to get total for all x values in db
	collection.mapReduce(map, reduce, {out:  {replace : 'xTotal'}}, (err, tempCollection) =>{
		
		var xClicksValue=0;
		var yClicksValue=0;
	    
	    if(err) return console.log(err);

	    //find the result from the temp collection
		tempCollection.findOne({}, (req,result)=>{
	      	if(result != null){     
	      		if(typeof result.value.x != "undefined"){
	      			xClicksValue = result.value.x;
	      			yClicksValue = result.value.y;
	      		}
	      		else{
	      			xClicksValue = result.value[0];
	      			yClicksValue = result.value[1];
	      		}
	      	}
		});

		//return all the data to the Stats page. 
		collection.find({}).sort( { x_pos: -1 } ).toArray((err, docs) =>{
			if(err) console.log("error" + err);

			res.render('Stats',{title:"Click Stats",data:docs, totalClicks: docs.length,clickTotal: [xClicksValue,yClicksValue]})

		});	
	
	});	
});

//route for a routes with document id passed as a param
var userRouteID = router.route('/stats/:_id');

userRouteID.all((req,res,next)=>{
     next();
});

//delete document by id
userRouteID.delete((req,res,next)=>{

	var id = req.params._id;
    //remove document where _id = id passed to route
    collection.deleteOne({ _id : new mongo.ObjectID(id)}, function(err, result) {
     	if(err) return console.log(err);
	});

    console.log('removing document with id ' + id);
    res.sendStatus(200);
});


Date.prototype.timeNow = function () {
     return ((this.getHours() < 10)?"0":"") + this.getHours() +":"+ ((this.getMinutes() < 10)?"0":"") + this.getMinutes() +":"+ ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
}

var map = function(){
	var numClicks = this.clicks.length;
	emit(1,[(this.x_pos*numClicks),(this.y_pos*numClicks)])
}	

var reduce 	= function(key,values){
	
	var sumX=0,sumY=0;
	for (i = 0; i < values.length; i++) { 
		sumX += values[i][0];
		sumY += values[i][1];
	}
	return {"x": sumX, "y": sumY }
}
