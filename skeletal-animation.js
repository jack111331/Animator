function configureMaterials( object ) {
    object.totalMaterial = 0;
    object.currentLoadMaterial = 0;

    for(var i = 0;i < object.materials.length;i++) {
        var material = object.materials[i];
        for(var j = 0;j < material.properties.length;j++) {
            var texture = material.properties[j];
            if(texture.semantic != 0 && texture.type == 3) {
                object.totalMaterial++;
                var image = new Image();
                image.texture = object.materials[i].properties[j];
                image.onload = function() {
                    this.texture.texture = gl.createTexture();
                    gl.bindTexture( gl.TEXTURE_2D, this.texture.texture );
                    gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this );
                    gl.generateMipmap( gl.TEXTURE_2D );
                    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR );
                    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
                    object.currentLoadMaterial++;
                };
                //FIXME still bugsome
                image.src = "Bob/"+texture.value; // TODO generalize
            }
        }
    }
}
function handleLoadedModelBone(object, node) {
    if(object.boneIndexDict == undefined) {
        object.boneIndexDict = new Map();
    }
    object.boneIndexDict.set(node.name, object.boneIndexDict.size)
    if(node.children != undefined) {

        for(var i = 0;i < node.children.length;i++) {
            handleLoadedModelBone(object, node.children[i])
        }
    }
}

function handleLoadedModel(object) {
    // Deal with bones
    handleLoadedModelBone(object, object.rootnode.children[0]) // need to find out rig node
    console.log(object.boneIndexDict);
    
    // Deal with meshes
    var meshesCount = object.meshes.length;
    object.vbo = new Array(meshesCount);
    object.ebo = new Array(meshesCount);
    for(var i = 0;i < meshesCount;i++) {
        // extract bone
        var mesh = object.meshes[i];
        var bonesCount = mesh.bones.length;
        if(object.boneOffsetMatrixDict == undefined) {
            object.boneOffsetMatrixDict = new Map(); // boneOffsetMatrix transform mesh space to bone space
        }
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
            var boneIndex = object.boneIndexDict.get(bone.name);
            object.boneOffsetMatrixDict.set(boneIndex, new mat4(bone.offsetmatrix));
            for(var k = 0;k < bone.weights.length;k++) {
                // bone.weights[k][0] is vertice index
                // bone.weights[k][1] is vertice weight in this bone 
                // [currentBone[bone.weights[k][0]]++] is this vertices has33 accumulate to one of [0, 3]'s bone
                var mappedIndex = bone.weights[k][0];
                var mappedIndexWeight = bone.weights[k][1];
                bonesIndexPerVertices[mappedIndex][currentBone[mappedIndex]] = boneIndex;
                bonesWeightPerVertices[mappedIndex][currentBone[mappedIndex]++] = mappedIndexWeight;
            }
        }
        mesh.boneWeight = flatten(bonesWeightPerVertices);
        mesh.boneIndex = new Uint16Array(bonesIndexPerVertices.flat());
        console.log(mesh.boneIndex);
        console.log(mesh.boneWeight);
        mesh.faces = new Uint16Array(mesh.faces.flat());

        // pass data to gpu
        object.vbo[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, object.vbo[i]);
        gl.bufferData(gl.ARRAY_BUFFER, 4 * (mesh.vertices.length + mesh.normals.length + mesh.texturecoords[0].length +  mesh.boneWeight.length) + 2 * (mesh.boneIndex.length), gl.STATIC_DRAW);

        var destOffset = 0;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.vertices));
        destOffset += 4 * mesh.vertices.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.normals));
        destOffset += 4 * mesh.normals.length;
        gl.bufferSubData(gl.ARRAY_BUFFER, destOffset, flatten(mesh.texturecoords));
        destOffset += 4 * mesh.texturecoords[0].length;
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
        // pass bone into uniform
    
        var keyframeBones = computeKeyframeBone(object, object.rootnode.children[0], object.animations[0], 0, 0, 0.7);
        for(var i = 0;i < keyframeBones.matrix.length;i++) {
            var ithBoneMatrix = 'boneMatrix['+ i.toString() + ']';
            gl.uniformMatrix4fv(gl.getUniformLocation(program, ithBoneMatrix), false, flatten(keyframeBones.matrix[i]));
        }
        for(var i = 0;i < 6;i++) {
            // use mesh
            var mesh = object.meshes[i];
            gl.bindBuffer( gl.ARRAY_BUFFER, object.vbo[i] );
            
            var destOffset = 0;
            gl.vertexAttribPointer( 0, 3, gl.FLOAT, false, 0, destOffset );
            destOffset += 4 * mesh.vertices.length;
            gl.vertexAttribPointer( 1, 3, gl.FLOAT, false, 0, destOffset );
            destOffset += 4 * mesh.normals.length;
            gl.vertexAttribPointer( 2, 2, gl.FLOAT, false, 0, destOffset );
            destOffset += 4 * mesh.texturecoords[0].length;
            gl.vertexAttribPointer( 3, 4, gl.FLOAT, false, 0, destOffset );
            destOffset += 4 * mesh.boneWeight.length;
            gl.vertexAttribIPointer( 4, 4, gl.UNSIGNED_SHORT, 0, destOffset );
            for(var j = 0;j < 5;j++) {
                gl.enableVertexAttribArray(j);
            }

            // use material
            var material = object.materials[mesh.materialindex];
            for(var j = 0;j < material.properties.length;j++) {
                var texture = material.properties[j];
                if(texture.type == 3) {
                    if(texture.semantic == 1) {
                        gl.uniform1i(gl.getUniformLocation(program, "diffuseTexture"), 1);
                        gl.activeTexture(gl.TEXTURE0 + 1);
                        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
                    } else if(texture.semantic == 2) {
                        gl.uniform1i(gl.getUniformLocation(program, "specularTexture"), 2);
                        gl.activeTexture(gl.TEXTURE0 + 2);
                        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
                    } else if(texture.semantic == 5) {
                        gl.uniform1i(gl.getUniformLocation(program, "heightTexture"), 5);
                        gl.activeTexture(gl.TEXTURE0 + 5);
                        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
                    } else if(texture.semantic == 6) {
                        gl.uniform1i(gl.getUniformLocation(program, "normalTexture"), 6);
                        gl.activeTexture(gl.TEXTURE0 + 6);
                        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
                    }
                }
            }
            gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, object.ebo[i] );
            gl.uniformMatrix4fv( modelingLoc,   0, flatten(object.transform) );
            gl.drawElements( gl.TRIANGLES, mesh.faces.length, gl.UNSIGNED_SHORT, 0 );
        }
    }
}
function findmaxBelowNumber(keyArray, number) {
    var buf = -1;
    for(var i = 0;i < keyArray.length;i++) {
        if(buf < 0) {
            if(keyArray[i][0] <= number) {
                buf = i;
            }
        } else {
            if(keyArray[i][0] > keyArray[buf][0] && keyArray[i][0] <= number) {
                buf = i;
            }
        }
    }
    return buf;
}
function interpolate(vectorFirst, vectorSecond, portion) {
    var result = new Array(3);
    for(var i = 0;i < 3;i++) {
        result[i] = (1.0-portion) * vectorFirst[i] + portion * vectorSecond[i];
    }
    return result;
}
function getLength(vector) {
    return Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);
}
function getAngle(vectorFirst, vectorSecond) {
    return Math.acos((vectorFirst[0] * vectorSecond[0] + vectorFirst[1] * vectorSecond[1] + vectorFirst[2] * vectorSecond[2]) / (getLength(vectorFirst) * getLength(vectorSecond)));
}
function computeKeyframeBone(object, rootnode, animation, keyframeFirst, keyframeSecond, timePortion) {
    var boneCount = animation.channels.length;
    
    var keyframeFirstBones = new Object();
    keyframeFirstBones.positionkey = new Array(boneCount);
    keyframeFirstBones.rotationkey = new Array(boneCount);
    keyframeFirstBones.scalingkey = new Array(boneCount);

    var keyframeSecondBones = new Object();
    keyframeSecondBones.positionkey = new Array(boneCount);
    keyframeSecondBones.rotationkey = new Array(boneCount);
    keyframeSecondBones.scalingkey = new Array(boneCount);

    var keyframeFinalBones = new Object();
    keyframeFinalBones.positionkey = new Array(boneCount);
    keyframeFinalBones.rotationkey = new Array(boneCount);
    keyframeFinalBones.scalingkey = new Array(boneCount);
    keyframeFinalBones.matrix = new Array(boneCount);

    for(var i = 0;i < boneCount;i++) {
        var channel = animation.channels[i];
        var boneIndex = object.boneIndexDict.get(channel.name);

        keyframeFirstBones.positionkey[boneIndex] = channel.positionkeys[findmaxBelowNumber(channel.positionkeys, keyframeFirst)][1];
        keyframeFirstBones.rotationkey[boneIndex] = channel.rotationkeys[findmaxBelowNumber(channel.rotationkeys, keyframeFirst)][1];
        keyframeFirstBones.scalingkey[boneIndex] = channel.scalingkeys[findmaxBelowNumber(channel.scalingkeys, keyframeFirst)][1];

        keyframeSecondBones.positionkey[boneIndex] = channel.positionkeys[findmaxBelowNumber(channel.positionkeys, keyframeSecond)][1];
        keyframeSecondBones.rotationkey[boneIndex] = channel.rotationkeys[findmaxBelowNumber(channel.rotationkeys, keyframeSecond)][1];
        keyframeSecondBones.scalingkey[boneIndex] = channel.scalingkeys[findmaxBelowNumber(channel.scalingkeys, keyframeSecond)][1];
        
    }
    
    computeBone(object, rootnode, new mat4(), keyframeFirstBones, keyframeSecondBones, keyframeFinalBones, timePortion);
    return keyframeFinalBones;
}
function computeBone(object, node, parentTransform, keyframeFirstBones, keyframeSecondBones, keyframeFinalBones, timePortion) {
    var boneIndex = object.boneIndexDict.get(node.name);
    
    keyframeFinalBones.positionkey[boneIndex] = interpolate(keyframeFirstBones.positionkey[boneIndex], keyframeSecondBones.positionkey[boneIndex], timePortion);
    var firstRotation = new Quaternion(keyframeFirstBones.rotationkey[boneIndex][0], keyframeFirstBones.rotationkey[boneIndex][1], keyframeFirstBones.rotationkey[boneIndex][2], keyframeFirstBones.rotationkey[boneIndex][3]);
    var secondRotation = new Quaternion(keyframeSecondBones.rotationkey[boneIndex][0], keyframeSecondBones.rotationkey[boneIndex][1], keyframeSecondBones.rotationkey[boneIndex][2], keyframeSecondBones.rotationkey[boneIndex][3]);
    keyframeFinalBones.rotationkey[boneIndex] = firstRotation.slerp(secondRotation)(timePortion);// FIXME timePortion
    keyframeFinalBones.scalingkey[boneIndex] = interpolate(keyframeFirstBones.scalingkey[boneIndex], keyframeSecondBones.scalingkey[boneIndex], timePortion);

    keyframeFinalBones.matrix[boneIndex] = translate(keyframeFinalBones.positionkey[boneIndex][0], keyframeFinalBones.positionkey[boneIndex][1], keyframeFinalBones.positionkey[boneIndex][2]);
    keyframeFinalBones.matrix[boneIndex] = mult(scale(keyframeFinalBones.scalingkey[boneIndex][0], keyframeFinalBones.scalingkey[boneIndex][1], keyframeFinalBones.scalingkey[boneIndex][2]), keyframeFinalBones.matrix[boneIndex]);
    keyframeFinalBones.matrix[boneIndex] = mult(new mat4(keyframeFinalBones.rotationkey[boneIndex].toMatrix4()), keyframeFinalBones.matrix[boneIndex]);
    keyframeFinalBones.matrix[boneIndex] = mult(parentTransform, keyframeFinalBones.matrix[boneIndex]);
    if(node.children != undefined) {
        for(var i = 0;i < node.children.length;i++) {
            computeBone(object, node.children[i], keyframeFinalBones.matrix[boneIndex], keyframeFirstBones, keyframeSecondBones, keyframeFinalBones, timePortion);
        }
    }
    var originBoneIndex = object.boneIndexDict.get("origin");
    var inverseToWorldMatrix = math.inv(keyframeFinalBones.matrix[originBoneIndex]);
    inverseToWorldMatrix.matrix = true;
    if(object.boneOffsetMatrixDict.get(boneIndex) != undefined) {
        keyframeFinalBones.matrix[boneIndex] = mult(inverseToWorldMatrix, mult(keyframeFinalBones.matrix[boneIndex], object.boneOffsetMatrixDict.get(boneIndex)));
//         keyframeFinalBones.matrix[boneIndex] = mult(keyframeFinalBones.matrix[boneIndex], object.boneOffsetMatrixDict.get(boneIndex));
    }
}
