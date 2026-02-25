const root = document.getElementById('app');

if (root) {
  root.innerHTML = [
    '<p><strong>Status:</strong> Workspace scaffold is ready.</p>',
    '<p>Next: connect Babylon table scene to @poker/poker-engine.</p>',
  ].join('');
}
