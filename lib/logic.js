'use strict';
const namespace = 'blockspaces.parttracker';

/**
 * Manufacturer Request Part Certification
 * @param {blockspaces.parttracker.RequestPartCertification} tx
 * @transaction
 */
async function requestPartCertification(tx) {
    console.log('@debug: entering requestPartCertification');
    try {     
        let factory = await getFactory();
        let newCertRequestAsset=factory.newResource(namespace,'CertificateRequest',getGuid());
        newCertRequestAsset.part=tx.part;
        newCertRequestAsset.certIssuer=tx.certifier;

        displayObjectValues('certRequest',newCertRequestAsset);

        let newCertRequestRegistry= await getAssetRegistry(namespace+'.CertificateRequest')
        await newCertRequestRegistry.add(newCertRequestAsset);

        let event=getFactory().newEvent(namespace,'PartCertRequested');
        event.certifier=tx.certifier;
        event.part=tx.part;
        console.log('@debug: firing event PartCertRequested');
        emit(event);

    } catch(error) {
        console.log(error);
        throw new Error(error);
    } finally {
        console.log('@debug: exiting requestPartCertification');
    }
}

/**
 * Oracle Approves Part Certification
 * @param {blockspaces.parttracker.ApprovePartCertification} tx
 * @transaction
 */
async function approvePartCertification(tx) {
    console.log('@debug: entering approvePartCertification');
    try { 

        let partRegistry= await getAssetRegistry(namespace+'.Part')
        let part=tx.certRequest.part;
        if (part.certStatus!="PENDING") {
            throw new Error("A cert request for this part already processed");
        }
        let factory = await getFactory();
        let newCertAsset=factory.newResource(namespace,'Certificate',getGuid());
        newCertAsset.certIssuer=tx.certifier;
        newCertAsset.part=tx.certRequest.part;
        newCertAsset.certStatus="APPROVED";

        displayObjectValues('cert',newCertAsset);

        let certRegistry= await getAssetRegistry(namespace+'.Certificate')
        await certRegistry.add(newCertAsset);

        let certRequestRegistry= await getAssetRegistry(namespace+'.CertificateRequest')
        let certRequest=tx.certRequest;
        certRequest.certStatus="APPROVED";
        displayObjectValues('certRequest',certRequest);

        await certRequestRegistry.update(certRequest);


        part.certStatus="APPROVED";
        part.certificate=newCertAsset;
        displayObjectValues('part',part);

        await partRegistry.update(part);

        let event=getFactory().newEvent(namespace,'PartCertAppoved');
        event.part=tx.certRequest.part;
        event.certifier=tx.certifier;
        console.log('@debug: firing event PartCertAppoved');
        emit(event);

    } catch(error) {
        console.log(error);
        throw new Error(error);
    } finally {
        console.log('@debug: exiting approvePartCertification');
    }
}

/**
 * Oracle Deny Part Certification
 * @param {blockspaces.parttracker.DenyPartCertification} tx
 * @transaction
 */

 async function denyPartCertification(tx) {
    console.log('@debug: entering denyPartCertification');
    try {
        let partRegistry= await getAssetRegistry(namespace+'.Part')
        let part=tx.certRequest.part;
        if (part.certStatus!="PENDING") {
            throw new Error("A cert request for this part already processed");
        }

        let factory = await getFactory();
        let newCertAsset=factory.newResource(namespace,'Certificate',getGuid());
        newCertAsset.certIssuer=tx.certifier;
        newCertAsset.part=tx.certRequest.part;
        newCertAsset.certStatus="DENIED";
        
        displayObjectValues('cert',newCertAsset);

        let certRegistry= await getAssetRegistry(namespace+'.Certificate')
        await certRegistry.add(newCertAsset);

        let certRequestRegistry= await getAssetRegistry(namespace+'.CertificateRequest')
        let certRequest=tx.certRequest;
        certRequest.certStatus="DENIED";
        displayObjectValues('certRequest',certRequest);

        await certRequestRegistry.update(certRequest);
       
        part.certStatus="DENIED";
        displayObjectValues('part',part);

        await partRegistry.update(part);

        let event=getFactory().newEvent(namespace,'PartCertDenied');
        event.part=tx.certRequest.part;
        event.certifier=tx.certifier;
        console.log('@debug: firing event PartCertDenied');
        emit(event);

    } catch(error) {
        console.log(error);
        throw new Error(error);
    } finally {
        console.log('@debug: exiting denyPartCertification');
    }
 }

 /**
 * PlantOwner Order Parts
 * @param {blockspaces.parttracker.OrderParts} tx
 * @transaction
 */

 async function  orderParts(tx) {
    console.log('@debug: entering orderParts');
    try {
        let factory = await getFactory();
        const orderId=getGuid();
        let newOrderAsset=factory.newResource(namespace,'Order',orderId);
        let parts = [];
        let orderEntries=tx.orderEntries;

        for (const orderEntry of orderEntries) {
            const part=orderEntry.part;
            displayObjectValues('part',part);
            if (part.certStatus!='APPROVED') {
                throw new Error('part is not certified');
            } else {
                parts.push(part);
            }
        }
    
        newOrderAsset.orderEntries=orderEntries;
        newOrderAsset.buyer=tx.buyer;
        
        displayObjectValues('order',newOrderAsset);

        console.log('@debug:creating Order:'+orderId);
        let orderRegistry= await getAssetRegistry(namespace+'.Order')
        await orderRegistry.add(newOrderAsset);

        let event=getFactory().newEvent(namespace,'PartsOrdered');
        event.parts=parts;
        event.certifier=tx.buyer;
        console.log('@debug: firing event PartsOrdered');
        emit(event);
    } catch(error) {
        console.log(error);
        throw new Error(error);
    } finally {
        console.log('@debug: exiting orderParts');
    }
 }

/**
 * Mechanic performs a maintenance task
 * @param {blockspaces.parttracker.InstallParts} tx
 * @transaction
 */

async function  installParts(tx) {
    try {
        console.log('@debug: entering installParts');

        const parts=tx.parts;
        let partsToInstall = [];

        for (const part of parts) {
            displayObjectValues('part',part);
            if (part.certStatus!='APPROVED') {
                throw new Error('part is not certified');
            } else {
                partsToInstall.push(part);
            }
        }

        let factory = await getFactory();
        const taskId=getGuid();
        let newMntTaskAsset=factory.newResource(namespace,'MaintenanceTask',taskId);
        
        newMntTaskAsset.parts=partsToInstall;
        newMntTaskAsset.mechanic=tx.mechanic;
        newMntTaskAsset.buyer=tx.buyer;
        
        displayObjectValues('MaintenanceTask',newMntTaskAsset);

        console.log('@debug:creating MaintenanceTask:'+taskId);
        let mntTaskRegistry= await getAssetRegistry(namespace+'.MaintenanceTask');
        await mntTaskRegistry.add(newMntTaskAsset);

        let event=getFactory().newEvent(namespace,'PartsInstalled');
        event.parts=parts;
        event.mechanic=tx.mechanic;
        event.buyer=tx.buyer;
        console.log('@debug: firing event PartsInstalled');
        emit(event);

    } catch(error) {
        console.log(error);
        throw new Error(error);
    } finally {
        console.log('@debug: exiting installParts');
    }
}

 function getGuid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  function displayObjectValues(_string, _object) {
      for (var prop in _object) {
          console.log('@debug:'+_string+'-->'+prop+';\t '+(((typeof(_object[prop])==='object') || (typeof(_object[prop])==='function')) ? typeof(_object[prop]) : _object[prop]));
      }
  }