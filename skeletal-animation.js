function configureMaterials( object ) {
    object.totalMaterial = 0;
    object.currentLoadMaterial = 0;

    for(var i = 0;i < object.materials.length;i++) {
        var material = object.materials[i];
        for(var j = 0;j < material.properties.length;j++) {
            var texture = material.properties[j];
            if(texture.semantic != 0) {
                object.totalMaterial++;
                var image = new Image();
                image.texture = object.materials[i].properties[j];
                image.onload = function() {
                    this.texture.texture = gl.createTexture();
                    gl.bindTexture( gl.TEXTURE_2D, this.texture.texture );
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                    gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image );
                    gl.generateMipmap( gl.TEXTURE_2D );
                    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, 
                                    gl.NEAREST_MIPMAP_LINEAR );
                    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
                    object.currentLoadMaterial++;
                };
                image.src = "SA2011_black.gif"; // TODO generalize
            }
        }
    }
}
function handleLoadedModel(object) {
    // Deal with meshes
    var meshesCount = object.meshes.length;
    object.vbo = new Array(meshesCount);
    object.ebo = new Array(meshesCount);
    for(var i = 0;i < meshesCount;i++) {
        // extract bone
        var mesh = object.meshes[i];
        var bonesCount = mesh.bones.length;
        mesh.boneIndexDict = new Map();
        mesh.boneOffsetMatrixDict = new Map();
        var bonesIndexPerVertices = new Array(mesh.vertices.length);
        var bonesWeightPerVertices = new Array(mesh.vertices.length);
        var currentBone = new Array(mesh.vertices.length);
        for(var j = 0;j < mesh.vertices.length;j++) {
            bonesIndexPerVertices[j] = new Array(4);
            bonesWeightPerVertices[j] = new Array(4);
            for(var k = 0;k < 4;k++) {
                bonesIndexPerVertices[j][k] = 0;
                bonesWeightPerVertices[j][k] = 0.0;
            }
            currentBone[j] = 0;
        }
        for(var j = 0;j < bonesCount;j++) {
            var bone = mesh.bones[j];
            if(mesh.boneIndexDict.has(bone.name) == false) {
                mesh.boneIndexDict.set(bone.name, mesh.boneIndexDict.size);
            }
            var boneIndex = mesh.boneIndexDict.get(bone.name);
            mesh.boneOffsetMatrixDict.set(boneIndex, bone.offsetmatrix);
            for(var k = 0;k < bone.weights.length;k++) {
                // bone.weights[k][0] is vertice index
                // bone.weights[k][1] is vertice weight in this bone 
                // [currentBone[bone.weights[k][0]]++] is this vertices has accumulate to one of [0, 3]'s bone
                var mappedIndex = bone.weights[k][0];
                var mappedIndexWeight = bone.weights[k][1];
                bonesIndexPerVertices[mappedIndex][currentBone[mappedIndex]] = boneIndex;
                bonesWeightPerVertices[mappedIndex][currentBone[mappedIndex]++] = mappedIndexWeight;
            }
        }
        mesh.boneWeight = flatten(bonesWeightPerVertices);
        mesh.boneIndex = new Uint16Array(bonesIndexPerVertices.flat());
        mesh.faces = new Uint16Array(mesh.faces.flat());

        // pass data to gpu        
        object.vbo[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, object.vbo[i]);
        gl.bufferData(gl.ARRAY_BUFFER, 4 * (mesh.vertices.length + mesh.normals.length + mesh.texturecoords.length +  mesh.boneWeight.length) + 2 * (mesh.boneIndex.length), gl.STATIC_DRAW);

        var destOffset = 0;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.vertices));
        destOffset += 4 * mesh.vertices.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.normals));
        destOffset += 4 * mesh.normals.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.texturecoords));
        destOffset += 4 * mesh.texturecoords.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, mesh.boneWeight);
        destOffset += 4 * mesh.boneWeight.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, mesh.boneIndex);

        object.ebo[i] = gl.createBuffer();
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, object.ebo[i] );
        gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, mesh.faces, gl.STATIC_DRAW );
    }
    // deal with materials
    configureMaterials(object);
}
function renderAssimpObject(object)
{
    if(object.currentLoadMaterial == object.totalMaterial) {
        for(var i = 0;i < object.meshes.length;i++) {
            // use mesh
            var mesh = object.meshes[i];
            gl.bindBuffer( gl.ARRAY_BUFFER, object.vbo[i] );
            
            var destOffset = 0;
            gl.vertexAttribPointer( 0, 3, gl.FLOAT, false, 0, destOffset );
            destOffset += 4 * mesh.vertices.length;
            gl.vertexAttribPointer( 1, 3, gl.FLOAT, false, 0, destOffset );
            destOffset += 4 * mesh.normals.length;
            gl.vertexAttribPointer( 2, 2, gl.FLOAT, false, 0, destOffset );
            destOffset += 4 * mesh.texturecoords.length;
            gl.vertexAttribPointer( 3, 4, gl.FLOAT, false, 0, destOffset );
            destOffset += 4 * mesh.boneWeight.length;
            gl.vertexAttribPointer( 4, 4, gl.UNSIGNED_SHORT, false, 0, destOffset );

            // use material
            var material = object.materials[mesh.materialindex];
            for(var j = 0;j < material.properties.length;j++) {
                var texture = material.properties[j];
                if(texture.semantic == 1) {
                    gl.uniform1i(gl.getUniformLocation(program, "diffuseTexture"), 1);
                    gl.activeTexture(gl.TEXTURE0 + 1);
                } else if(texture.semantic == 2) {
                    gl.uniform1i(gl.getUniformLocation(program, "specularTexture"), 2);
                    gl.activeTexture(gl.TEXTURE0 + 2);
                } else if(texture.semantic == 5) {
                    gl.uniform1i(gl.getUniformLocation(program, "heightTexture"), 5);
                    gl.activeTexture(gl.TEXTURE0 + 5);
                } else if(texture.semantic == 6) {
                    gl.uniform1i(gl.getUniformLocation(program, "normalTexture"), 6);
                    gl.activeTexture(gl.TEXTURE0 + 6);
                }
                gl.bindTexture(gl.TEXTURE_2D, texture.texture);
            }
            gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, object.ebo[i] );
            gl.uniformMatrix4fv( modelingLoc,   0, flatten(object.transform) );
            gl.drawElements( gl.TRIANGLES, mesh.faces.length, gl.UNSIGNED_SHORT, 0 );
        }
    }
}
function computeKeyframeBone(object, animObject, keyframeFirst, keyframeSecond) {
}
