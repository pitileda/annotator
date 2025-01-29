export function identityMatrix() {
  return [1, 0, 0, 1, 0, 0];
}

export function translate(tx, ty) {
  return [1, 0, 0, 1, tx, ty];
}

export function scale(sx, sy) {
  return [sx, 0, 0, sy, 0, 0];
}

export function rotate(angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, sin, -sin, cos, 0, 0];
}

export function shearX(shx) {
  return [1, 0, shx, 1, 0, 0];
}

// Multiply m1 by m2 => returns new matrix
// Canvas does transformations in the order you call ctx.transform(...).
export function multiply(m1, m2) {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ];
}

/** Transform a point (x, y) by a matrix M => [X, Y] */
export function transformPoint(M, x, y) {
  const [a, b, c, d, e, f] = M;
  const X = a * x + c * y + e;
  const Y = b * x + d * y + f;
  return [X, Y];
}

/**
 * Invert a 2D transform matrix [a, b, c, d, e, f].
 * Returns a new array [A, B, C, D, E, F] which is the inverse transform.
 */
export function invert(matrix) {
  const [a, b, c, d, e, f] = matrix;
  const det = a * d - b * c;
  
  // If determinant is zero, the matrix is not invertible.
  if (!det) {
    console.warn("Cannot invert matrix, determinant=0. Returning identity.");
    return [1, 0, 0, 1, 0, 0];
  }
  const invDet = 1 / det;

  // Inverse (for the standard 3x3 extended form):
  //   [ a  c  e ] => [  d  -c   cf - de ]
  //   [ b  d  f ] => [ -b   a   be - af ]
  //   [ 0  0  1 ] => [  0   0       1    ]
  //
  // and then all multiplied by 1/det.
  const A = d * invDet;
  const B = -b * invDet;
  const C = -c * invDet;
  const D = a * invDet;
  const E = (c * f - d * e) * invDet;
  const F = (b * e - a * f) * invDet;

  return [A, B, C, D, E, F];
}

