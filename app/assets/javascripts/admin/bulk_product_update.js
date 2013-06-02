var productsApp = angular.module('bulk_product_update', [])

productsApp.config(["$httpProvider", function(provider) {
  provider.defaults.headers.common['X-CSRF-Token'] = $('meta[name=csrf-token]').attr('content');
}]);

productsApp.directive('ngDecimal', function () {
	return {
		require: 'ngModel',
		link: function(scope, element, attrs, ngModel) {
			var numRegExp = /^\d+(\.\d+)?$/;
			
			element.bind('blur', function() {
				scope.$apply(ngModel.$setViewValue(ngModel.$modelValue));
				ngModel.$render();
			});
			
			ngModel.$setValidity('notADecimalError', function(){
				if (angular.isString(ngModel.$modelValue) && numRegExp.test(ngModel.$modelValue)){
					return true;
				}
				else{
					return false;
				}
			});
			
			ngModel.$parsers.push(function(viewValue){
				if (angular.isString(viewValue) && numRegExp.test(viewValue)){
					if (viewValue.indexOf(".") == -1){
						return viewValue+".0";
					}
				}
				return viewValue;
			});
		}
	}
});

productsApp.controller('AdminBulkProductsCtrl', function($scope, $timeout, $http, dataFetcher) {
	$scope.refreshSuppliers = function(){
		dataFetcher('/enterprises/suppliers.json').then(function(data){
			$scope.suppliers = data;
		});
	};
	
	$scope.refreshProducts = function(){
		dataFetcher('/admin/products/bulk_index.json').then(function(data){
			$scope.products = angular.copy(data);
			$scope.cleanProducts = angular.copy(data);
		});
	};
	
	$scope.updateOnHand = function(product){
		product.on_hand = onHand(product);
	}

	$scope.updateStatusMessage = {
		text: "",
		style: {}
	}

	$scope.updateProducts = function(productsToSubmit){
		$scope.displayUpdating();
		$http({
			method: 'POST',
			url: '/admin/products/bulk_update',
			data: productsToSubmit
		})
		.success(function(data){
			if (angular.toJson($scope.products) == angular.toJson(data)){
				$scope.cleanProducts = angular.copy(data);
				$scope.displaySuccess();
			}
			else{
				$scope.displayFailure("Product lists do not match.");
			}
		})
		.error(function(data,status){
			$scope.displayFailure("Server returned with error status: "+status);
		});
	}
	
	$scope.prepareProductsForSubmit = function(){
		var productsToSubmit = getDirtyObjects($scope.products,$scope.cleanProducts);
		productsToSubmit = filterSubmitProducts(productsToSubmit);
		$scope.updateProducts(productsToSubmit);
	}
	
	$scope.setMessage = function(model,text,style,timeout){
		model.text = text;
		model.style = style;
		if (timeout){
			$timeout(function() { $scope.setMessage(model,"",{},false); }, timeout, true);
		}
	}
	
	$scope.displayUpdating = function(){
		$scope.setMessage($scope.updateStatusMessage,"Updating...",{ color: "orange" },false);
	}
	
	$scope.displaySuccess = function(){
		$scope.setMessage($scope.updateStatusMessage,"Update complete",{ color: "green" },3000);
	}
	
	$scope.displayFailure = function(failMessage){
		$scope.setMessage($scope.updateStatusMessage,"Updating failed. "+failMessage,{ color: "red" },10000);
	}
});

productsApp.factory('dataFetcher', function($http,$q){
	return function(dataLocation){
		var deferred = $q.defer();
		$http.get(dataLocation).success(function(data) {
			deferred.resolve(data);
		}).error(function(){
			deferred.reject();
		});
		return deferred.promise;
	};
});

function onHand(product){
	var onHand = 0;
	if(product.hasOwnProperty('variants') && product.variants instanceof Array){
		angular.forEach(product.variants, function(variant) {
			onHand = parseInt( onHand ) + parseInt( variant.on_hand > 0 ? variant.on_hand : 0 );
		});
	}
	else{
		onHand = 'error';
	}
	return onHand;
}

function sortByID(array){
	var sortedArray = [];
	for (var i in array){
		if (array[i].hasOwnProperty("id")){
			sortedArray.push(array[i]);
		}
	}
	sortedArray.sort(function(a, b){
		return a.id - b.id;
	});
	return sortedArray;
}

// This function returns all objects in cleanList which are able to be matched to an bjects in ListOne using the id properties of each
// In the event that no items in cleanList match the id of an item in testList, the testList item is duplicated and placed into the returned lits
// This means that the returned list has an identical length and identical ids to the testList, with only the values of other properties differing
function getMatchedObjects(testList, cleanList){
	testList = sortByID(testList);
	cleanList = sortByID(cleanList);
	
	var matchedObjects = [];
	var ti = 0, ci = 0;
	
	while (ti < testList.length){
		if (testList[ti].hasOwnProperty("id")){
			if (cleanList[ci].hasOwnProperty("id")){
				while (ci < cleanList.length && cleanList[ci].id<testList[ti].id){
					ci++;
				}
				if (cleanList[ci] && cleanList[ci].hasOwnProperty("id") && cleanList[ci].id==testList[ti].id){
					matchedObjects.push(cleanList[ci])
				}
				else{
					matchedObjects.push(testList[ti])
				}
			}
		}
		ti++;
	}
	return matchedObjects;
}

function getDirtyPropertiesOfObject(testObject, cleanObject){
	var dirtyProperties = {};
	for (var key in testObject){
		if (testObject.hasOwnProperty(key) && cleanObject.hasOwnProperty(key)){
			if (testObject[key] != cleanObject[key]){
				if (testObject[key] instanceof Array){
					if (key == "variants"){
						dirtyProperties[key] = getDirtyObjects(testObject[key],cleanObject[key]);
					}
					else{
						dirtyProperties[key] = testObject[key];
					}
				}
				else if(testObject[key] instanceof Object){
					var tempObject = getDirtyPropertiesOfObject(testObject[key],cleanObject[key]);
					if ( !isEmpty(tempObject) ){
						if (testObject[key].hasOwnProperty("id")) { tempObject["id"] = testObject[key].id; }
						dirtyProperties[key] = tempObject;
					}
				}
				else{
					dirtyProperties[key] = testObject[key];
				}
			}
		}
	}
	return dirtyProperties;
}

function getDirtyObjects(testObjects, cleanObjects){
	var dirtyObjects = [];
	var matchedCleanObjects = getMatchedObjects(testObjects,cleanObjects);
	testObjects = sortByID(testObjects);
	
	for (var i in testObjects){
		var dirtyObject = getDirtyPropertiesOfObject(testObjects[i], matchedCleanObjects[i])
		if ( !isEmpty(dirtyObject) ){
			dirtyObject["id"] = testObjects[i].id;
			dirtyObjects.push(dirtyObject);
		}
	}
	return dirtyObjects;
}

function filterSubmitProducts(productsToFilter){
	var filteredProducts= [];

	if (productsToFilter instanceof Array){
		for (i in productsToFilter) {
			if (productsToFilter[i].hasOwnProperty("id")){
				var filteredProduct = {};
				var filteredVariants = [];

				if (productsToFilter[i].hasOwnProperty("variants")){ 
					for (j in productsToFilter[i].variants){
						if (productsToFilter[i].variants[j].deleted_at == null && productsToFilter[i].variants[j].hasOwnProperty("id")){
							filteredVariants[j] = {};
							filteredVariants[j].id = productsToFilter[i].variants[j].id;
							if (productsToFilter[i].variants[j].hasOwnProperty("on_hand")) filteredVariants[j].on_hand = productsToFilter[i].variants[j].on_hand;
							if (productsToFilter[i].variants[j].hasOwnProperty("price")) filteredVariants[j].price = productsToFilter[i].variants[j].price;
						}
					}
				}

				var hasUpdatableProperty = false;
				filteredProduct.id = productsToFilter[i].id;
				if (productsToFilter[i].hasOwnProperty("name")) { filteredProduct.name = productsToFilter[i].name; hasUpdatableProperty = true; }
				if (productsToFilter[i].hasOwnProperty("supplier_id")) { filteredProduct.supplier_id = productsToFilter[i].supplier_id; hasUpdatableProperty = true; }
				//if (productsToFilter[i].hasOwnProperty("master")) filteredProduct.master_attributes = productsToFilter[i].master
				if (productsToFilter[i].hasOwnProperty("price")) { filteredProduct.price = productsToFilter[i].price; hasUpdatableProperty = true; }
				if (productsToFilter[i].hasOwnProperty("on_hand") && filteredVariants.length == 0) { filteredProduct.on_hand = productsToFilter[i].on_hand; hasUpdatableProperty = true; } //only update if no variants present
				if (productsToFilter[i].hasOwnProperty("available_on")) { filteredProduct.available_on = productsToFilter[i].available_on; hasUpdatableProperty = true; }
				if (filteredVariants.length > 0) { filteredProduct.variants_attributes = filteredVariants; hasUpdatableProperty = true; } // Note that the name of the property changes to enable mass assignment of variants attributes with rails

				if (hasUpdatableProperty) filteredProducts.push(filteredProduct);
			}
		}
	}
	return filteredProducts;
}

function isEmpty(object){
    for (var i in object){
        if (object.hasOwnProperty(i)){
            return false;
        }
    }
    return true;
}