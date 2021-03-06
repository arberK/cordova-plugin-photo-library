// Assume browser supports lambdas

var async = cordova.require('cordova-plugin-photo-library.async');

var photoLibraryProxy = {

  getLibrary: function (success, error, [options]) {

    checkSupported();

    let filesElement = createFilesElement();

    filesElement.addEventListener('change', (evt) => {

      let files = getFiles(evt.target);
      files2Library(files, options.itemsInChunk, options.chunkTimeSec, (library, isLastChunk) => {
        if (isLastChunk) {
          removeFilesElement(filesElement);
        }
        success({ library: library, isLastChunk: isLastChunk }, {keepCallback: !isLastChunk});
      });

    }, false);

  },

  _getThumbnailURLBrowser: function (success, error, [photoId, options]) {
    photoLibraryProxy.getThumbnail(
      imageData => {
        let thumbnailURL = URL.createObjectURL(imageData.data);
        success(thumbnailURL);
      },
      error,
      [photoId, options]);
  },

  _getPhotoURLBrowser: function (success, error, [photoId, options]) {
    photoLibraryProxy.getPhoto(
      imageData => {
        let photoURL = URL.createObjectURL(imageData.data);
        success(photoURL);
      },
      error,
      [photoId, options]);
  },

  getThumbnail: function (success, error, [photoId, options]) {

    let staticItem = staticLibrary.get(photoId);
    if (!staticItem) {
      error(`Photo with id ${photoId} not found in the library`);
      return;
    }
    //let libraryItem = staticItem.libraryItem;

    let {thumbnailWidth, thumbnailHeight, quality} = options;

    readDataURLAsImage(staticItem.dataURL).then(image => {
      let canvas = document.createElement('canvas');
      let context = canvas.getContext('2d');
      canvas.width = thumbnailWidth;
      canvas.height = thumbnailHeight;
      context.drawImage(image, 0, 0, thumbnailWidth, thumbnailHeight);
      canvas.toBlob((blob) => {
        success({ data: blob, mimeType: blob.type });
      }, 'image/jpeg', quality);
    });

  },

  getPhoto: function (success, error, [photoId, options]) {

    let staticItem = staticLibrary.get(photoId);
    if (!staticItem) {
      error(`Photo with id ${photoId} not found in the library`);
      return;
    }
    //let libraryItem = staticItem.libraryItem;

    let blob = dataURLToBlob(staticItem.dataURL);
    success({ data: blob, mimeType: blob.type });

  },

  stopCaching: function (success, error) {
    // Nothing to do
    success();
  },

  requestAuthorization: function (success, error) {
    // Nothing to do
    success();
  },

  saveImage: function (url, album, success, error) {
    // TODO - implement saving on browser
    error('not implemented');
  },

  saveVideo: function (url, album, success, error) {
    // TODO - implement saving on browser
    error('not implemented');
  },

};

module.exports = photoLibraryProxy;

require('cordova/exec/proxy').add('PhotoLibrary', photoLibraryProxy);

const HIGHEST_POSSIBLE_Z_INDEX = 2147483647;

var staticLibrary = new Map();
var counter = 0;

function checkSupported() {
  // Check for the various File API support.
  if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
    throw ('The File APIs are not fully supported in this browser.');
  }
}

function createFilesElement() {
  var filesElement = document.createElement('input');
  filesElement.type = 'file';
  filesElement.name = 'files[]';
  filesElement.multiple = true;
  filesElement.style.zIndex = HIGHEST_POSSIBLE_Z_INDEX;
  filesElement.style.position = 'relative';
  filesElement.className = 'cordova-photo-library-select';
  document.body.appendChild(filesElement);
  return filesElement;
}

function removeFilesElement(filesElement) {
  filesElement.parentNode.removeChild(filesElement);
}

function getFiles(filesElement) {
  //convert from array-like to real array
  let files = Array.from(filesElement.files); // FileList object
  return files.filter(f => f.type.match('image.*'));
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    reader.readAsDataURL(file);
  });
}

function readDataURLAsImage(dataURL) {
  return new Promise((resolve, reject) => {
    var imageObj = new Image();
    imageObj.onload = () => {
      resolve(imageObj);
    };
    imageObj.src = dataURL;
  });
}

function files2Library(files, itemsInChunk, chunkTimeSec, success) {

  let chunk = [];
  let chunkStartTime = new Date().getTime();

  async.eachOfSeries(files, (file, index, done) => {

    readFileAsDataURL(file)
      .then(dataURL => {
        return readDataURLAsImage(dataURL).then(image => {
          return { dataURL, image };
        });
      })
      .then(dataURLwithImage => {
        let {image, dataURL} = dataURLwithImage;
        let {width, height} = image;

        let libraryItem = {
          id: `${counter}#${file.name}`,
          fileName: file.name,
          width: width,
          height: height,
          creationDate: file.lastModifiedDate.toISOString(), // file contains only lastModifiedDate
          //TODO: latitude, using exif-js
          //TODO: longitude
        };
        counter += 1;

        staticLibrary.set(libraryItem.id, { libraryItem: libraryItem, dataURL: dataURL });

        chunk.push(libraryItem);

        if (index === files.length - 1) {
          success(chunk, true);
        } else if ((itemsInChunk > 0 && chunk.length === itemsInChunk) || (chunkTimeSec > 0 && (new Date().getTime() - chunkStartTime) >= chunkTimeSec*1000)) {
          success(chunk, false);
          chunk = [];
          chunkStartTime = new Date().getTime();
        }

        done();

      });

  });

}

// From here: https://gist.github.com/davoclavo/4424731
function dataURLToBlob(dataURL) {
  // convert base64 to raw binary data held in a string
  var byteString = atob(dataURL.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  var arrayBuffer = new ArrayBuffer(byteString.length);
  var _ia = new Uint8Array(arrayBuffer);
  for (var i = 0; i < byteString.length; i++) {
    _ia[i] = byteString.charCodeAt(i);
  }

  var dataView = new DataView(arrayBuffer);
  var blob = new Blob([dataView], { type: mimeString });
  return blob;
}
