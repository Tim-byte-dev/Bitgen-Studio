/* bitGen Studio — the 3D bundle's entry (2.382.0). Built by scripts/vendor/build-three.sh into
 * static/vendor/three-m3d.min.js (one classic script, window.H3THREE) - three.js r186 + the loaders the timeline canvas's
 * 3D layers use (FBX, OBJ + MTL, glTF, TTF -> Font -> TextGeometry). Everything is local: no CDN at run time. */
export * from "three";
export { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
export { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
export { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
export { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";   // 2.385.0: .glb / .gltf (the Blender add-on)
export { FontLoader, Font } from "three/examples/jsm/loaders/FontLoader.js";
export { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
export { TTFLoader } from "./TTFLoader.local.js";
export { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";          // 2.403.0: the Blender scene viewer
export { TransformControls } from "three/examples/jsm/controls/TransformControls.js";  // 2.403.0: move / rotate / scale
