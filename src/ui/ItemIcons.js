export const ITEM_META = {
  rocket: { name: '開路火箭', icon: '🚀', color: '#ff7b55', hint: '找到對手後自動追擊' },
  shield: { name: '泡泡盾', icon: '🫧', color: '#7aeaff', hint: '獲得後 10 秒內自動抵擋一次道具攻擊' },
  eagle: { name: '召喚老鷹', icon: '🦅', color: '#ffc96b', hint: '自動攻擊領先的對手' },
  lightning: { name: '全圖落雷', icon: '⚡', color: '#ffea63', hint: '抽中後立即發動' }
};

// Same small, readable illustrations are used in the HUD and above every actor.
// x/y is the icon centre; size is its full width in canvas pixels.
export function drawItemIcon(ctx, type, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#172943';
  const polygon = (points, fill) => {
    ctx.beginPath(); points.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
  };
  if (type === 'rocket') {
    ctx.rotate(Math.PI / 5);
    polygon([[-12, 25], [0, 47], [12, 25]], '#ffbd32');
    polygon([[-5, 25], [0, 39], [5, 25]], '#fff0a0');
    polygon([[-13, 0], [-27, 24], [-11, 19]], '#ff574b');
    polygon([[13, 0], [27, 24], [11, 19]], '#ff574b');
    ctx.fillStyle = '#f2f8ff'; ctx.beginPath(); ctx.roundRect(-14, -22, 28, 48, 8); ctx.fill(); ctx.stroke();
    polygon([[-14, -20], [0, -43], [14, -20]], '#ff574b');
    ctx.beginPath(); ctx.arc(0, -7, 8, 0, Math.PI * 2); ctx.fillStyle = '#5bddff'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#b6d1df'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(7, 8); ctx.lineTo(7, 19); ctx.stroke();
  } else if (type === 'shield') {
    const gradient = ctx.createRadialGradient(-15, -18, 2, 0, 0, 41);
    gradient.addColorStop(0, '#e6fdff'); gradient.addColorStop(.5, '#83eaff'); gradient.addColorStop(1, '#527ff0');
    ctx.beginPath(); ctx.arc(0, 0, 39, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 29, Math.PI * 1.08, Math.PI * 1.48); ctx.stroke();
    ctx.strokeStyle = '#172943';
    polygon([[-17, -13], [0, -20], [17, -13], [13, 10], [0, 23], [-13, 10]], '#e8faff');
    ctx.strokeStyle = '#4294d2'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-1, 6); ctx.lineTo(9, -7); ctx.stroke();
  } else if (type === 'eagle') {
    polygon([[-7, 2], [-27, -23], [-44, -30], [-34, -4], [-20, 12], [-4, 17]], '#b27a46');
    polygon([[7, 2], [27, -23], [44, -30], [34, -4], [20, 12], [4, 17]], '#b27a46');
    polygon([[-10, 18], [-15, 37], [0, 31], [15, 37], [10, 18]], '#805439');
    ctx.beginPath(); ctx.ellipse(0, 11, 17, 22, 0, 0, Math.PI * 2); ctx.fillStyle = '#98653e'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(3, -9, 15, 16, -.15, 0, Math.PI * 2); ctx.fillStyle = '#fff9e8'; ctx.fill(); ctx.stroke();
    polygon([[12, -11], [27, -3], [12, 1]], '#ffd056');
    ctx.fillStyle = '#172943'; ctx.beginPath(); ctx.arc(8, -12, 3, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'lightning') {
    polygon([[4, -43], [-28, 6], [-4, 6], [-12, 42], [31, -11], [7, -11], [18, -43]], '#ffe253');
    ctx.strokeStyle = '#fff8cd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(5, -28); ctx.lineTo(-14, -1); ctx.stroke();
  } else {
    ctx.fillStyle = '#ffe55e'; ctx.beginPath(); ctx.roundRect(-36, -36, 72, 72, 14); ctx.fill(); ctx.stroke();
    ctx.font = '900 62px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    ctx.strokeText('?', 0, 3); ctx.fillText('?', 0, 3);
  }
  ctx.restore();
}

const iconCache = new Map();
export function itemIconDataUrl(type) {
  if (!iconCache.has(type)) {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    drawItemIcon(ctx, type, 80, 80, 144);
    iconCache.set(type, canvas.toDataURL());
  }
  return iconCache.get(type);
}
