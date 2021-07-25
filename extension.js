
/*****************************************************************
                         CONST & VARS
*****************************************************************/
const GObject = imports.gi.GObject;
const Cinnamon = imports.gi.Cinnamon;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Panel = imports.ui.panel;
const St = imports.gi.St;

let focusMetaWindow = false;
let tracker;
let toggleSettingListener;
let preferences = {};

let beginGrabOpId;
let endGrabOpId;

const PADDING = 10;
const COLLUMNS = 4;
const ROWS = 3;

const CONTAINERS = [
  [0,0,1,1], [1,0,2,1], [3,0,1,1],  // [1][22][3]   // [ ][  ][ ] // [ ][ ][ ] // [ ][  ][ ]
  [0,1,1,2], [0,1,2,2], [1,1,3,2],  // [4][66666]   // [ ][   [7] // [ ][][88] // [ ][99][ ]
  [3,1,1,2], [1,1,2,2], [2,1,2,2],  // [5][66666]   // [ ][   [7] // [ ][][88] // [ ][99][ ]
];

/*****************************************************************
                            SETTINGS
*****************************************************************/
function initSettings() {
  const settings = new Settings.ExtensionSettings(preferences, 'gridder@termina');

  settings.bindProperty(Settings.BindingDirection.IN, 'screen1', 'screen1', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screen2', 'screen2', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screen3', 'screen3', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screen4', 'screen4', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screen5', 'screen5', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screen6', 'screen6', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screen7', 'screen7', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screen8', 'screen8', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screen9', 'screen9', enableHotkey, null);

  settings.bindProperty(Settings.BindingDirection.IN, 'screenLeft', 'screenLeft', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screenRight', 'screenRight', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screenUp', 'screenUp', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'screenDown', 'screenDown', enableHotkey, null);

  settings.bindProperty(Settings.BindingDirection.IN, 'snapToPlan', 'snapToPlan', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'snapToGrid', 'snapToGrid', enableHotkey, null);
  settings.bindProperty(Settings.BindingDirection.IN, 'swapCurrentBlockFocus', 'swapCurrentBlockFocus', enableHotkey, null);
}

/*****************************************************************
                            FUNCTIONS
*****************************************************************/
function init() {}

function enable() {
  tracker = Cinnamon.WindowTracker.get_default();

  initSettings();
  enableHotkey();

  tracker.connect(
    'notify::focus-app',
    () => {
      _onFocus();
    }
  );
}

function disable() {
  global.display.disconnect(beginGrabOpId);
  global.display.disconnect(endGrabOpId);
  disableHotkey();
  destroyGrids();
  resetFocusMetaWindow();
}

function enableHotkey() {
  disableHotkey();
  Main.keybindingManager.addHotKey('screen1', preferences.screen1, () => snapToGrid(1));
  Main.keybindingManager.addHotKey('screen2', preferences.screen2, () => snapToGrid(2));
  Main.keybindingManager.addHotKey('screen3', preferences.screen3, () => snapToGrid(3));
  Main.keybindingManager.addHotKey('screen4', preferences.screen4, () => snapToGrid(4));
  Main.keybindingManager.addHotKey('screen5', preferences.screen5, () => snapToGrid(5));
  Main.keybindingManager.addHotKey('screen6', preferences.screen6, () => snapToGrid(6));
  Main.keybindingManager.addHotKey('screen7', preferences.screen7, () => snapToGrid(7));
  Main.keybindingManager.addHotKey('screen8', preferences.screen8, () => snapToGrid(8));
  Main.keybindingManager.addHotKey('screen9', preferences.screen9, () => snapToGrid(9));

  Main.keybindingManager.addHotKey('screenLeft', preferences.screenLeft, () => moveToGrid('left'));
  Main.keybindingManager.addHotKey('screenRight', preferences.screenRight, () => moveToGrid('right'));
  Main.keybindingManager.addHotKey('screenUp', preferences.screenUp, () => moveToGrid('up'));
  Main.keybindingManager.addHotKey('screenDown', preferences.screenDown, () => moveToGrid('down'));

  Main.keybindingManager.addHotKey('snapToPlan', preferences.snapToPlan, () => gridAtMouse(true));
  Main.keybindingManager.addHotKey('snapToGrid', preferences.snapToGrid, () => gridAtMouse(false));
  Main.keybindingManager.addHotKey('swapCurrentBlockFocus', preferences.swapCurrentBlockFocus, swapCurrentBlockFocus);
}

function disableHotkey() {
  Main.keybindingManager.removeHotKey('screen1');
  Main.keybindingManager.removeHotKey('screen2');                                     
  Main.keybindingManager.removeHotKey('screen3');
  Main.keybindingManager.removeHotKey('screen4');
  Main.keybindingManager.removeHotKey('screen5');
  Main.keybindingManager.removeHotKey('screen6');
  Main.keybindingManager.removeHotKey('screen7');
  Main.keybindingManager.removeHotKey('screen8');
  Main.keybindingManager.removeHotKey('screen9');

  Main.keybindingManager.removeHotKey('screenLeft');
  Main.keybindingManager.removeHotKey('screenRight');
  Main.keybindingManager.removeHotKey('screenUp');
  Main.keybindingManager.removeHotKey('screenDown');

  Main.keybindingManager.removeHotKey('snapToPlan');
  Main.keybindingManager.removeHotKey('snapToGrid');
  Main.keybindingManager.removeHotKey('swapCurrentBlockFocus');
}

function moveToGrid(direction, usePlan = true) {
  let rect = focusMetaWindow.get_outer_rect();
  let monitor = Main.layoutManager.primaryMonitor;
  let [x, y, width, height] = getUsableScreenArea(monitor);
  let blockW = (width - (PADDING*(COLLUMNS+1))) / COLLUMNS;
  let blockH = (height - (PADDING*(ROWS+1))) / ROWS;

  switch(direction) {
    case 'left':
      rect.x -= (blockW+PADDING);
      break;
    case 'right':
      rect.x += (blockW+PADDING);
      break;
    case 'up':
      rect.y -= (blockH+PADDING);
      break;
    case 'down':
      rect.y += (blockH+PADDING);
      break;
    default:
  }

  let bounds = [rect.x, rect.y];
  bounds = getNearestGridBounds(bounds);

  if(usePlan) {
    bounds = gridBoundsToPlan(bounds);
  }

  postitionOnGrid(bounds);
}

function swapCurrentBlockFocus() {
  const monitor = Main.layoutManager.primaryMonitor;
  let windows = getNotFocusedWindowsOfMonitor(monitor);

  if(windows) {
    const newWindow = windows.find(window => {

        let win = window.get_outer_rect();
        
        const [winX, winY] = getNearestGridBounds([ win.x, win.y ]);
        let [actX, actY] = getNearestGridBounds(global.get_pointer());

        return winX === actX && winY === actY;
    });

    if(newWindow) {
      newWindow.activate(0);
    }
  }
}

function snapToGrid(num) {
  if (!focusMetaWindow) return;

  reset_window(focusMetaWindow);

  postitionOnGrid(CONTAINERS[num-1]);
}

function gridAtMouse(usePlan) {

  let bounds = getNearestGridBounds(global.get_pointer());

  if(usePlan) {
    bounds = gridBoundsToPlan(bounds);
  }

  postitionOnGrid(bounds);
}

function getNearestGridBounds([posX, posY]) {
  let monitor = Main.layoutManager.primaryMonitor;
  let [x, y, width, height] = getUsableScreenArea(monitor);
  let blockW = (width - (PADDING*(COLLUMNS+1))) / COLLUMNS;
  let blockH = (height - (PADDING*(ROWS+1))) / ROWS;

  let snapX = Math.floor((posX-x)/(blockW+PADDING));
  let snapY = Math.floor((posY-y)/(blockH+PADDING));

  return [snapX, snapY, 1, 1];
}

function gridBoundsToPlan(bounds) {
  let [x, y] = bounds;
  return CONTAINERS.find(([_x, _y]) => x == _x && y == _y) || bounds;
}

function postitionOnGrid([gridX, gridY, gridW, Gridh], window = focusMetaWindow) {
  let monitor = Main.layoutManager.primaryMonitor;
  let [x, y, width, height] = getUsableScreenArea(monitor);

  let blockW = (width - (PADDING*(COLLUMNS+1))) / COLLUMNS;
  let blockH = (height - (PADDING*(ROWS+1))) / ROWS;

  let _x = x + ((gridX+1) * PADDING) + (gridX*blockW);
  let _y = y + ((gridY+1) * PADDING) + (gridY*blockH);

  let _width = ((gridW*blockW) + (PADDING * (gridW-1)));
  let _height = ((Gridh*blockH) + (PADDING * (Gridh-1)));

  move_resize_window(focusMetaWindow, _x, _y, _width, _height);
}

function move_resize_window(metaWindow, x, y, width, height) {
  let [vBorderX, vBorderY] = _getVisibleBorderPadding(metaWindow);

  width = width - vBorderX;
  height = height - vBorderY;

  metaWindow.resize(true, width, height);
  metaWindow.move_frame(true, x, y);
}

function reset_window(metaWindow) {
  metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL);
  metaWindow.unmaximize(Meta.MaximizeFlags.VERTICAL);
  metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
  metaWindow.tile(Meta.WindowTileType.NONE, false);
}

function _getVisibleBorderPadding(metaWindow) {
  let clientRect = metaWindow.get_rect();
  let outerRect = metaWindow.get_outer_rect();

  let borderX = outerRect.width - clientRect.width;
  let borderY = outerRect.height - clientRect.height;

  return [borderX, borderY];
}

function getPanelHeight(panel) {
  return panel.height
      || panel.actor.get_height();  // fallback for old versions of Cinnamon
}

function resetFocusMetaWindow() {
  focusMetaWindow = false;
}

function _onFocus() {
  let window = getFocusApp();
  resetFocusMetaWindow();
  focusMetaWindow = window;
}

function getFocusApp() {
  return global.display.focus_window;
}

function isPrimaryMonitor(monitor) {
  return Main.layoutManager.primaryMonitor === monitor;
}

function getNotFocusedWindowsOfMonitor(monitor) {
  return Main.getTabList().filter(function(w) {
    let app = tracker.get_window_app(w);
    let w_monitor = Main.layoutManager.monitors[w.get_monitor()];

    if (app == null) {
      return false;
    }
    if (w.minimized) {
      return false;
    }
    if (w_monitor !== monitor) {
      return false;
    }

    return focusMetaWindow !== w && w.get_wm_class() != null;
  });
}

function getUsableScreenArea(monitor) {
  let top = monitor.y;
  let bottom = monitor.y + monitor.height;
  let left = monitor.x;
  let right = monitor.x + monitor.width;

  for (let panel of Main.panelManager.getPanelsInMonitor(monitor.index)) {
    if (!panel.isHideable()) {
      switch (panel.panelPosition) {
        case Panel.PanelLoc.top:
          top += getPanelHeight(panel);
          break;
        case Panel.PanelLoc.bottom:
          bottom -= getPanelHeight(panel);
          break;
        case Panel.PanelLoc.left:
          left += getPanelHeight(panel); // even vertical panels use 'height'
          break;
        case Panel.PanelLoc.right:
          right -= getPanelHeight(panel);
          break;
      }
    }
  }

  let width = right > left ? right - left : 0;
  let height = bottom > top ? bottom - top : 0;
  return [left, top, width, height];
}