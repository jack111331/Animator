 
 
function handleLoadedModel(object) {
    var meshesCount = object.meshes.length;
    console.log(meshesCount);
    object.vbo = new Array(meshesCount);
    for(var i = 0;i < meshesCount;i++) {
        // extract bone
        var mesh = object.meshes[i];
        var bonesCount = mesh.bones.length;
        var boneIndexDict = new Map();
        var boneOffsetMatrixDict = new Map();
        var bonesIndexPerVertices = new Array(mesh.vertices.length);
        var bonesWeightPerVertices = new Array(mesh.vertices.length);
        for(var j = 0;j < mesh.vertices.length;j++) {
            bonesIndexPerVertices[j] = new Array(4);
            bonesIndexPerVertices[j].currentBone = 0;
            bonesWeightPerVertices[j] = new Array(4);
            bonesWeightPerVertices[j].currentBone = 0;
        }
        for(var j = 0;j < bonesCount;j++) {
            var bone = mesh.bones[j];
            if(!boneIndexDict.has(bone.name)) {
                boneIndexDict.set(bone.name, boneIndexDict.length)
            }
            var boneIndex = boneIndexDict.get(bone.name);
            boneOffsetMatrixDict.set(boneIndex, bone.offsetmatrix);
            for(var k = 0;k < bone.weights.length;k++) {
                // bone.weights[k][0] is vertice index
                // bone.weights[k][1] is vertice weight in this bone 
                // [bonesPerVertices[j].currentBone++] is this vertices has accumulate to one of [0, 3]'s bone
                bonesIndexPerVertices[bone.weights[k][0]][bonesIndexPerVertices[j].currentBone++] = boneIndex;
                bonesWeightPerVertices[bone.weights[k][0]][bonesWeightPerVertices[j].currentBone++] = bone.weights[k][1];
            }
        }
        
        // pass data to gpu
        object.vbo[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, object.vbo[i]);
        gl.bufferData(gl.ARRAY_BUFFER, flatten([]), gl.STATIC_DRAW, 0, 4 * (mesh.vertices.length + mesh.normals.length + mesh.texturecoords.length +  bonesWeightPerVertices.length) + 2 * (bonesIndexPerVertices.length));

        var destOffset = 0;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.vertices), 0, 4 * mesh.vertices.length);
        destOffset += 4 * mesh.vertices.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.normals), 0, 4 * mesh.normals.length);
        destOffset += 4 * mesh.normals.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.texturecoords), 0, 4 * mesh.texturecoords.length);
        destOffset += 4 * mesh.texturecoords.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(bonesWeightPerVertices), 0, 4 * bonesWeightPerVertices.length);
        destOffset += 4 * bonesWeightPerVertices.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, new Uint16Array(bonesIndexPerVertices), 0, 2 * bonesIndexPerVertices.length);

        
        object.ebo = gl.createBuffer();
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, object.ebo );
        gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, object.faces, gl.STATIC_DRAW );
    }
}
