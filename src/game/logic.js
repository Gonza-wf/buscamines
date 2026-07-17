// Dificultades clásicas — la densidad de minas sube con la dificultad,
// lo que hace el puzzle genuinamente más difícil de resolver.
export const DIFFICULTIES = {
  EASY:   { rows: 9,  cols: 9,  mines: 10, name: 'Fácil',   label: 'F', density: '12%' },
  MEDIUM: { rows: 16, cols: 16, mines: 40, name: 'Medio',   label: 'M', density: '16%' },
  HARD:   { rows: 16, cols: 30, mines: 99, name: 'Difícil', label: 'D', density: '21%' },
};

export const generateEmptyBoard = (rows, cols) => {
  return Array(rows).fill(null).map(() => Array(cols).fill(null).map(() => ({
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    neighborMines: 0
  })));
};

export const placeMines = (board, rows, cols, mines, firstR, firstC) => {
  let minesPlaced = 0;
  
  // Guardar celdas seguras (el primer click y sus vecinos)
  const safeCells = new Set();
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      safeCells.add(`${firstR + i},${firstC + j}`);
    }
  }

  // En tableros pequeños con muchas minas, podría ser imposible proteger todos los vecinos.
  // Pero para las dificultades estándar, siempre hay espacio.
  const maxMines = (rows * cols) - safeCells.size;
  const actualMines = Math.min(mines, maxMines);

  while (minesPlaced < actualMines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    
    if (!board[r][c].isMine && !safeCells.has(`${r},${c}`)) {
      board[r][c].isMine = true;
      minesPlaced++;
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r][c].isMine) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            if (r + i >= 0 && r + i < rows && c + j >= 0 && c + j < cols) {
              if (board[r + i][c + j].isMine) {
                count++;
              }
            }
          }
        }
        board[r][c].neighborMines = count;
      }
    }
  }

  return board;
};

// Revelar celdas adyacentes usando Flood Fill
export const revealEmptyCells = (board, r, c, rows, cols) => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  
  const stack = [[r, c]];
  
  while (stack.length > 0) {
    const [currR, currC] = stack.pop();
    
    if (currR < 0 || currR >= rows || currC < 0 || currC >= cols) continue;
    
    const cell = newBoard[currR][currC];
    
    if (cell.isRevealed || cell.isFlagged || cell.isMine) continue;
    
    cell.isRevealed = true;
    
    if (cell.neighborMines === 0) {
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i !== 0 || j !== 0) {
            stack.push([currR + i, currC + j]);
          }
        }
      }
    }
  }
  
  return newBoard;
};

// Chording: si una celda revelada con número tiene todas sus banderas puestas,
// revelar automáticamente el resto de sus vecinos.
// Devuelve null si no aplica chording, o el nuevo tablero si sí.
export const chordReveal = (board, r, c, rows, cols) => {
  const cell = board[r][c];
  if (!cell.isRevealed || cell.isMine || cell.neighborMines === 0) return null;

  // Contar banderas adyacentes
  let flagCount = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      const nr = r + i, nc = c + j;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        if (board[nr][nc].isFlagged) flagCount++;
      }
    }
  }

  if (flagCount !== cell.neighborMines) return null;

  // Las banderas coinciden — revelar vecinos no marcados
  const newBoard = board.map(row => row.map(cl => ({ ...cl })));
  let hitMine = false;

  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      const nr = r + i, nc = c + j;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        const neighbor = newBoard[nr][nc];
        if (!neighbor.isRevealed && !neighbor.isFlagged) {
          if (neighbor.isMine) {
            neighbor.isRevealed = true;
            neighbor.exploded = true;
            hitMine = true;
          }
        }
      }
    }
  }

  if (hitMine) {
    // Revelar todas las minas
    const result = newBoard.map(row =>
      row.map(cl => cl.isMine ? { ...cl, isRevealed: true } : cl)
    );
    return { board: result, hitMine: true };
  }

  // Revelar con flood fill los vecinos seguros
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      const nr = r + i, nc = c + j;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        const neighbor = newBoard[nr][nc];
        if (!neighbor.isRevealed && !neighbor.isFlagged && !neighbor.isMine) {
          const flooded = revealEmptyCells(newBoard, nr, nc, rows, cols);
          // Mergear el resultado del flood en newBoard
          for (let rr = 0; rr < rows; rr++)
            for (let cc = 0; cc < cols; cc++)
              if (flooded[rr][cc].isRevealed) newBoard[rr][cc].isRevealed = true;
        }
      }
    }
  }

  return { board: newBoard, hitMine: false };
};

export const checkWinCondition = (board) => {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[0].length; c++) {
      const cell = board[r][c];
      if (!cell.isMine && !cell.isRevealed) {
        return false;
      }
    }
  }
  return true;
};
