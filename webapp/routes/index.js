var express = require('express');
var composer = require('composer-client');
var router = express.Router();


var adminCard = 'admin@part-tracker';
var chaincodeNS = 'blockspaces.parttracker';
var lastComposerResponse = {'message':'bigtest'};
var composerConnection = null;
var composerNetworkDefinition = null;
var composerEventListener = null;

var currentPartID = null;
var currentOrderNumber = null;
var currentOrderEntry = null;

/* GET home page. */
router.get('/index', function(req, res, next) {
  connectToComposer();
  res.sendFile('index.html', { root: 'public' });
});



/* GET home page. */
router.get('/lastResponse', function(req, res, next) {
  res.json(lastComposerResponse);
});


/* GET home page. */
router.get('/clearLastResponse', function(req, res, next) {
  lastComposerResponse = '';
  res.json(lastComposerResponse);
});





/* Create a part */
router.get('/createPart', function(req, res, next) {

  var factory = composerNetworkDefinition.getFactory();

  return Promise.all([
    composerConnection.getAssetRegistry(chaincodeNS + '.Part')
  ]).then( (registries) => {
      var partRegistry = registries[0];

      currentPartID = (new Date()).getTime().toString();
      var newPart = factory.newResource(chaincodeNS, 'Part', currentPartID);
      newPart.partName = 'Test Part - currentPartID';
      newPart.partNumber = currentPartID;
      newPart.price = 100.00;
      newPart.certStatus = 'PENDING';
      newPart.manufacturer = factory.newRelationship(chaincodeNS, 'Manufacturer', 'MANU001');
      
      return partRegistry.add(newPart);
  }).then((createdPart) => {

    var transaction = factory.newResource(chaincodeNS, 'RequestPartCertification', 'RequestPartCertification'+currentPartID);
    transaction.part = factory.newRelationship(chaincodeNS, 'Part', currentPartID);
    transaction.certifier = factory.newRelationship(chaincodeNS, 'CertifyingOracle', 'CERT001');
    transaction.manufacturer = factory.newRelationship(chaincodeNS, 'Manufacturer', 'MANU001');

    return composerConnection.submitTransaction(transaction);
  }).then( (certficateRequested) => {
    console.log('Certification requested');
    res.json("");
    return Promise.resolve(true);
  }).catch( (error) => {
    console.log('Certification Error');
    console.log(error);
    return Promise.reject(error);
  });
});



/* Certify a part */
router.get('/certifyPart', function(req, res, next) {

  var factory = composerNetworkDefinition.getFactory();
  var currentCertificateRequest = null;

  return Promise.all([
    composerConnection.getAssetRegistry(chaincodeNS + '.CertificateRequest')
  ]).then( (registries) => {
      var certificateRequestRegistry = registries[0];

      return certificateRequestRegistry.getAll();
  }).then( (allCertificateRequests) => {

    for(var i = 0; i < allCertificateRequests.length; i++){
      if(allCertificateRequests[i].part.$identifier == currentPartID){
        currentCertificateRequest = allCertificateRequests[i];
        break;
      }
    }

    var transaction = factory.newResource(chaincodeNS, 'ApprovePartCertification', 'ApprovePartCertification'+currentPartID);
    transaction.certRequest = factory.newRelationship(chaincodeNS, 'CertificateRequest', currentCertificateRequest.certReqId);
    transaction.certifier = factory.newRelationship(chaincodeNS, 'CertifyingOracle', 'CERT001');

    return composerConnection.submitTransaction(transaction);
  }).then( (certficateApproved) => {
    console.log('Certification approved');
    res.json("");
    return Promise.resolve(true);
  }).catch( (error) => {
    console.log('Certification Error');
    console.log(error);
    return Promise.reject(error);
  });
});



/* Purchase a certified part */
router.get('/purchasePart', function(req, res, next) {

  var factory = composerNetworkDefinition.getFactory();

  currentOrderEntry = factory.newConcept(chaincodeNS, 'OrderEntry');
  currentOrderEntry.part = factory.newRelationship(chaincodeNS, 'Part', currentPartID);
  currentOrderEntry.qty = 50;

  var transaction = factory.newResource(chaincodeNS, 'OrderParts', 'OrderParts'+currentPartID);
  transaction.orderEntries = [currentOrderEntry];
  transaction.buyer = factory.newRelationship(chaincodeNS, 'PlantOwner', 'PLNT001');

  return composerConnection.submitTransaction(transaction)
  .then( (partsOrdered) => {
    console.log('Parts ordered');
    res.json("");
    return Promise.resolve(true);
  }).catch( (error) => {
    console.log('Plant Order Error');
    console.log(error);
    return Promise.reject(error);
  });
});



/* Install a Certified Part */
router.get('/installCertifiedPart', function(req, res, next) {
  var factory = composerNetworkDefinition.getFactory();

  var transaction = factory.newResource(chaincodeNS, 'InstallParts', 'InstallParts'+currentPartID);
  transaction.parts = [factory.newRelationship(chaincodeNS, 'Part', currentPartID)];
  transaction.buyer = factory.newRelationship(chaincodeNS, 'PlantOwner', 'PLNT001');
  transaction.mechanic = factory.newRelationship(chaincodeNS, 'Mechanic', 'MECH001');

  return composerConnection.submitTransaction(transaction)
  .then( (partsInstalled) => {
    console.log('Parts Installed');
    res.json("");
    return Promise.resolve(true);
  }).catch( (error) => {
    console.log('Part Installation Error');
    console.log(error);
    return Promise.reject(error);
  });


});



/* Install a non-Certified Part */
router.get('/installNONCertifiedPart', function(req, res, next) {
  res.sendFile('index.html', { root: 'public' });
});



function connectToComposer(){
  if (composerConnection == null){
    composerConnection = new composer.BusinessNetworkConnection();
    composerConnection.connect(adminCard)
    .then( (definition) => {
      composerNetworkDefinition = definition;
      composerEventListener = composerConnection.on('event', (evt) => {
        handleComposerResponse(evt)
          .then( (success) => {
            if (!success) {
              console.log('WARNING: an error occurred');
              return;
            }
          }).catch( (error) => {
            console.log('ERROR: failed to process an event');
            console.log(error);
          });
      });

      composerConnection.on('error', (composerError) =>{
        console.log('ERROR: received an error from Composer');
        console.log(composerError);
      })

    });
  }
}


function handleComposerResponse(eventDetails){
  let eventType = eventDetails.$type;
  lastComposerResponse = {'message':eventType};
  
  console.log(eventType);
}




module.exports = router;
