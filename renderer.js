;(function(){
"use strict"

window.addEventListener("load", setupWebGL, false);
var gl, program, winform, minwid, nowlck, backbuff, backbuffpix;
var timeStart = Date.now()

async function setupWebGL (evt) {
  // Create a rendering context. In other words, create the base canvas to draw
  // the shader onto, pulling metadata about the setup like the maximum 
  // canvas resolution.
  window.removeEventListener(evt.type, setupWebGL, false);
  if (!(gl = getRenderingContext()))
    return;
  
  // Pull the scripts from the data provdided in the base HTML document at the
  // vertex-shader and fragment-shader id's
  var vsource = document.querySelector("#vertex-shader");
  var fsource = document.querySelector("#fragment-shader");

  // Compile the vertex shader through the webgl system. If the shader doesn't
  // compile nicely, display the error and halt.
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  // Pull the script from the hosted location. This is done for ease of
  // programming (glsl extension and syntax-highlighting and such), and is
  // needed to be done like this due to the src tag usage.
  await fetch(vsource.src).then(response => response.text())
    .then(data => {
      gl.shaderSource(vertexShader, data);
      gl.compileShader(vertexShader);
    });
  // If the shader reports that it could not compile correctly, stop the program
  // and display the error that was stored in the webgl system.
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    var cerrLog = gl.getShaderInfoLog(vertexShader);
    cleanup();
    document.querySelector("p").innerHTML =
      "Vertex shader did not compile successfully. "
      + "Error log: " + cerrLog;
    return;
  }

  // Do the exact same as above, but for a fragment shader instead.
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  await fetch(fsource.src).then(response => response.text())
    .then(data => {
      gl.shaderSource(fragmentShader, data);
      gl.compileShader(fragmentShader);
    });
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    var cerrLog = gl.getShaderInfoLog(fragmentShader);
    cleanup();
    document.querySelector("p").innerHTML = 
      "Fragment shader did not compile successfully. "
      + "Error log: " + cerrLog;
    return;
  }

  // Slap the shaders together with some glue.
  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  winform = gl.getUniformLocation(program, "winsize");
  minwid = gl.getUniformLocation(program, "minwid");
  nowlck = gl.getUniformLocation(program, "now");
  timelck = gl.getUniformLocation(program, "time");
  backbuff = gl.getUniformLocation(program, "backbuffer");
  gl.uniform2f(winform, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.uniform1f(minwid, smallestWinSize());
  gl.uniform1i(nowlck, Date.now());
  gl.uniform1i(timelck, Date.now()-timeStart)

  backbuffpix = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, backbuffpix);
  gl.texImage2D(backbuff, 0, gl.RGBA, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, backbuffpix);
  
  // Now that the program is all glued together, get rid of the compiled shader
  // chunks. We wouldn't want to eat up the ever-so-valueable resources would we?
  gl.detachShader(program, vertexShader);
  gl.detachShader(program, fragmentShader);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  // Another error trap that halts the program and displays what the fuck is
  // goin on.
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    var linkErrLog = gl.getProgramInfoLog(program);
    cleanup();
    document.querySelector("p").innerHTML = 
      "Shader program did not link successfully. "
      + "Error log: " + linkErrLog;
    return;
  } 

  // Attach the base shader attributes for the shaders to know what is going on
  // in the system.
  initializeAttributes();

  // Load the compiled and linked program, then make the program render itself at
  // approximately 30 fps. The extra code is needed to keep the canvas locked to
  // the size of the displaying window.
  // TODO: Better timing, event based window resize things
  gl.useProgram(program);
  setInterval(function() {
    var canvas = document.querySelector("canvas");
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    var gl = canvas.getContext("webgl") 
      || canvas.getContext("experimental-webgl");
    
    if (!gl) {
      var paragraph = document.querySelector("p");
      paragraph.innerHTML = "Failed to get WebGL context."
        + "Your browser or device may not support WebGL.";
      
      return null;
    }

    gl.viewport(0, 0, 
      gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(winform, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(minwid, smallestWinSize());
    gl.uniform1i(nowlck, new Date().getTime());
    gl.uniform1i(timelck, (new Date().getTime())-timeStart);
    
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, backbuffpix);
    gl.texImage2D(backbuff, 0, gl.RGBA, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, backbuffpix);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [(1./30.)*1000.]);
}

// Get the smallest of the two window dimensions for use in constant output ratio
// display for shaders.
function smallestWinSize() {
  // Compare the width vs the height and return the smallest.
  if (gl.drawingBufferWidth < gl.drawingBufferHeight) {
    return gl.drawingBufferWidth;
  }
  return gl.drawingBufferHeight;
}

// Sets up the attributes for the shaders that are running. This is used before
// everything is actually up and running (but after compilation), and is basically
// the anchor to the base of the shaders.
var posbuf;
function initializeAttributes() {
  // Create the base buffer for the vertices
  gl.enableVertexAttribArray(0);
  posbuf = gl.createBuffer();  
  gl.bindBuffer(gl.ARRAY_BUFFER, posbuf);

  // Set up the rendering triangle
  var positions = [
    -3, -3,
    3, 0.,
    -3, 3,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

// Make the main program null, delete the running program, and delete the main
// shader buffer.
function cleanup() {
  gl.useProgram(null);
  if (posbuf)
    gl.deleteBuffer(posbuf);
  if (program) 
    gl.deleteProgram(program);
}

// Get the rendering context of the screen and flush. The system constantly does
// this, but doesn't clear the whole screen to do it. This function is more of
// an initialization thing.
function getRenderingContext() {
  var canvas = document.querySelector("canvas");
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  var gl = canvas.getContext("webgl", {preserveDrawingBuffer: true}) 
    || canvas.getContext("experimental-webgl", {preserveDrawingBuffer: true});
  
  if (!gl) {
    var paragraph = document.querySelector("p");
    paragraph.innerHTML = "Failed to get WebGL context."
      + "Your browser or device may not support WebGL.";
    
    return null;
  }

  gl.viewport(0, 0, 
    gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return gl;
}
})();