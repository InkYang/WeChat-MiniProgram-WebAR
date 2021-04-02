const { createScopedThreejs } = require('threejs-miniprogram');
const { registerGLTFLoader } = require('./GLTFLoader.js');
// the scale of the 3d model
const initScale = 0.29;
// a track point on a pattern image
const trackPoint = {
    x: 185, // the width of the pattern image is 375
    y: 140, // the height of the pattern image is 375
};
var camera, scene, renderer;
var canvas;
var THREE;
var mainModel, requestId;
var canvasWidth, canvasHeight;

function initThree(canvasId, modelUrl) {
    wx.createSelectorQuery()
        .select('#' + canvasId)
        .node()
        .exec((res) => {
            canvas = res[0].node;
            THREE = createScopedThreejs(canvas);

            initScene();
            loadModel(modelUrl);
        });
}

function initScene() {
    camera = new THREE.OrthographicCamera(1, 1, 1, 1, -1000, 1000);
    scene = new THREE.Scene();
    // ambient light
    scene.add(new THREE.AmbientLight(0xffffff));
    // direction light
    var directionallight = new THREE.DirectionalLight(0xffffff, 1);
    directionallight.position.set(0, 0, 1000);
    scene.add(directionallight);

    // init render
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
    });
    const devicePixelRatio = wx.getSystemInfoSync().pixelRatio;
    console.log('device pixel ratio', devicePixelRatio);
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setSize(canvas.width, canvas.height);

    animate();
}

function loadModel(modelUrl) {
    registerGLTFLoader(THREE);
    var loader = new THREE.GLTFLoader();
    wx.showLoading({
        title: 'Loading Model...',
    });
    loader.load(modelUrl,
        function (gltf) {
            console.log('loadModel', 'success');
            var model = gltf.scene;
            // save model
            mainModel = new THREE.Group();
            // according to the gltf model size
            mainModel.scale.setScalar(initScale);
            mainModel.add(model);
            scene.add(mainModel);
            wx.hideLoading();
        },
        null,
        function (error) {
            console.log('loadModel', error);
            wx.hideLoading();
            wx.showToast({
                title: 'Loading model failed.',
                icon: 'none',
                duration: 3000,
            });
        });
}

function updateModel(modelUrl) {
    var loader = new THREE.GLTFLoader();
    // loading
    wx.showLoading({
        title: 'Loading Model...',
    });
    loader.load(modelUrl,
        function (gltf) {
            console.log('updateModel', 'success');
            var model = gltf.scene;
            // remove old model
            scene.remove(mainModel);
            // save new model
            mainModel = new THREE.Group();
            mainModel.scale.setScalar(initScale);
            mainModel.add(model);
            // add new model
            scene.add(mainModel);
            wx.hideLoading();
        },
        null,
        function (error) {
            console.log('updateModel', error);
            wx.hideLoading();
            wx.showToast({
                title: 'Loading model failed.',
                icon: 'none',
                duration: 3000,
            });
        });

    wx.hideLoading();
}

function setSize() {
    const w = canvasWidth;
    const h = canvasHeight;
    camera.left = -0.5 * w;
    camera.right = 0.5 * w;
    camera.top = 0.5 * h;
    camera.bottom = -0.5 * h;
    camera.updateProjectionMatrix();
}

function setModel(prediction,
    _canvasWidth,
    _canvasHeight) {

    if (_canvasWidth !== canvasWidth) {
        canvasWidth = _canvasWidth;
        canvasHeight = _canvasHeight;
        setSize();
    }

    console.log('prediction', prediction);

    if (!mainModel) {
        console.log('setModel', '3d model is not loaded.');
        return;
    }
    var transform = prediction.transform.data;

    // position
    var target = getTranslation(transform,
        trackPoint.x,
        trackPoint.y);
    mainModel.position.set(target._x - canvasWidth / 2,
        canvasHeight / 2 - target._y, 0);

    // rotation
    var r = getRotationAndScale(transform);
    // convert result to rotation matrix
    var rotationMatrix = new THREE.Matrix4();
    rotationMatrix.fromArray(r.rotation);
    mainModel.rotation.setFromRotationMatrix(rotationMatrix);

    // scale
    mainModel.scale.setScalar(initScale * r.scale);
}

function getTranslation(td, x, y) {
    var m00 = td[0], m01 = td[1], m02 = td[2],
        m10 = td[3], m11 = td[4], m12 = td[5],
        m20 = td[6], m21 = td[7], m22 = td[8];
    var x2 = m00 * x + m01 * y + m02;
    var y2 = m10 * x + m11 * y + m12;
    var ws = m20 * x + m21 * y + m22;
    var sc = 1.0 / ws;
    var _x = x2 * sc;
    var _y = y2 * sc;

    console.log('translation', _x, _y);

    return { _x, _y };

}

function getRotationAndScale(td) {
    var m00 = td[0],
        m10 = td[3],
        m20 = td[6];
    var norm = Math.sqrt(m00 * m00 +
        m10 * m10 +
        m20 * m20);
    // normal
    var H = td.map(function (item) {
        return item / norm;
    });

    m00 = H[0];
    m10 = H[3];
    m20 = H[6];

    var m01 = H[1], m02 = H[2],
        m11 = H[4], m12 = H[5],
        m21 = H[7], m22 = H[8];

    // rotate
    var c1 = [m00, m10, m20];
    var c2 = [m01, m11, m21];
    var c3 = [
        m21 * m10 - m20 * m11,
        m20 * m01 - m21 * m00,
        m00 * m11 - m10 * m01];

    var scale = 1 / m22;
    // convert 3x3 to 4x4
    var rotation =
        [c1[0], c2[0], c3[0], 0,
        c1[1], c2[1], c3[1], 0,
        c1[2], c2[2], c3[2], 0,
            0, 0, 0, 1
        ];

    console.log('scale', scale);
    console.log('rotation', rotation);

    return {
        scale,
        rotation
    };
}

function animate() {
    requestId = canvas.requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function stopAnimate() {
    if (canvas && requestId) {
        canvas.cancelAnimationFrame(requestId);
    }
}

function dispose() {
    camera = null;
    scene = null;
    renderer = null;
    canvas = null;
    THREE = null;
    mainModel = null;
    requestId = null;
    canvasWidth = null;
    canvasHeight = null;
}

module.exports = {
    initThree,
    stopAnimate,
    updateModel,
    setModel,
    dispose,
}