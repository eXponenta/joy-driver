class JoyServer {
	constructor(profiles) {
		this.profiles = profiles || {};

		this.onGamepadConnected = this.onGamepadConnected.bind(this);
		this.onGamepadDisconnected = this.onGamepadDisconnected.bind(this);
		this.updateStatus = this.updateStatus.bind(this);

		this.heldButtons = [];
		this.heldAxes = [];
		this._runned = false;
		this.activeGamepads = [];
	}

	/**
	 * 
	 * @param {Gamepad} pad 
	 */
	updatePad(pad, _time = 0) {
		const padProfile = this.profiles[pad.id] || this.profiles['any'];

		if (!padProfile) {
			return;
		}

		const buttonsProfile = padProfile.buttons;
		const axesProfile = padProfile.axes;
		const axesTreshold = this.profiles.axesThreshold || 0.7;
		const btnLen = pad.buttons.length;
		const axesLen = pad.axes.length;
		const heldButtons = this.heldButtons[pad.index];
		const heldAxes = this.heldAxes[pad.index];

		for (let bIdx = 0; bIdx < btnLen && buttonsProfile; bIdx++) {
			const button = pad.buttons[bIdx];

			if (typeof button === 'object' && buttonsProfile[bIdx]) {
				const from = { gamepad: pad, button: bIdx, value: button.value };

				if (button.pressed || button.value > 0.5) {
					if (!heldButtons[bIdx]) {
						heldButtons[bIdx] = true;
						this.fireDownEvent(buttonsProfile[bIdx], from);
					} else {
						this.firePressEvent(buttonsProfile[bIdx], from);
					}
				} else if(heldButtons[bIdx]) {
					heldButtons[bIdx] = false;
					this.fireUpEvent(buttonsProfile[bIdx], from);
				}
			}
		}

		for (let aIdx = 0; aIdx < axesLen && axesProfile; aIdx ++) {
			const value = pad.axes[aIdx];

			if (typeof value !== 'number') {
				continue;
			}

			// positive - 0 --  1, negative = -1 -- 0,
			// stored as different records
			const positiveProfile = axesProfile[aIdx * 2];
			const negativeProfile = axesProfile[aIdx * 2 + 1];
			const from = { gamepad: pad, axe: i, value };

			if (positiveProfile) {
				if (value > axesTreshold) {
					if (!heldAxes[aIdx * 2]) {
						heldAxes[aIdx * 2] = true;
						this.fireDownEvent(positiveProfile, from);
					} else {
						this.fireUpEvent(positiveProfile, from);	
					}
				} else if(heldAxes[aIdx * 2]) {
					this.firePressEvent(positiveProfile, from);
				}
			}

			if (negativeProfile) {
				if (value < -axesTreshold) {
					if (!heldAxes[aIdx * 2 + 1]) {
						heldAxes[aIdx * 2 + 1] = true;
						this.fireDownEvent(positiveProfile, from);
					} else {
						this.fireUpEvent(positiveProfile, from);	
					}
				} else if(heldAxes[aIdx * 2]) {
					this.firePressEvent(positiveProfile, from);
				}
			}
		}
	}

	fireEvent(kind, type, payload) {
		let event;
		if (kind === 'mouse') {
			payload.view = self;
			event = new MouseEvent('mouse' + type, payload);
		} else {
			event = new KeyboardEvent('key' + type, payload);
		}

		let target = document.activeElement;

		while (target.contentDocument) {
			target = target.contentDocument.activeElement;
		}

		target.dispatchEvent(event);

		console.debug('[JoyServer]', 'Emit:', kind + type, payload);
	}

	fireDownEvent(eventData, from) {
		this.fireEvent(eventData.kind, 'down', Object.assign({}, eventData, {from}))
	}

	fireUpEvent(eventData, from) {
		this.fireEvent(eventData.kind, 'up', Object.assign({}, eventData, {from}))
	}

	firePressEvent(eventData, from) {
		this.fireEvent(eventData.kind, 'press', Object.assign({}, eventData, {from}))
	}

	/**
	 * 
	 * @param {Gamepad} pad 
	 */
	fireUpEventDisconnect(pad) {
		const padProfile = this.profiles[pad.id] || this.profiles['any'];

		if (!padProfile) {
			return;
		}

		const buttonsProfile = padProfile.buttons;
		const axesProfile = padProfile.axes;
		const heldButtons = this.heldButtons[pad.index];
		const heldAxes = this.heldAxes[pad.index];

		if (heldButtons && buttonsProfile) {
			for(let button in heldButtons) {
				const profile = buttonsProfile[button];
				profile && heldButtons[button] && this.fireUpEvent(profile, { gamepad: pad, button, value: 0});

				heldButtons[button] = false;
			}
		}

		if (heldAxes && axesProfile) {
			for(let axe in heldAxes) {
				const profile = axesProfile[exe];
				profile && heldAxes[axe] && this.fireUpEvent(profile, { gamepad: pad, axe, value: 0});
				heldAxes[axe] = false;
			}
		}
	}

	updateStatus(_time) {
		if (!this._runned) {
			return;
		}

		const pads = navigator.getGamepads();

		for(let i = 0; i < pads.length; i ++) {
			const pad = pads[i];

			if (!pad) {
				continue;
			}

			this.updatePad(pad);
		}

		self.requestAnimationFrame(this.updateStatus);
	}

	onGamepadConnected({gamepad}) {		
		console.debug('[JoyServer]', 'Gamepad connected:', gamepad.id);

		this.heldButtons[gamepad.index] = [];
		this.heldAxes[gamepad.index] = [];
		this.activeGamepads[gamepad.index] = gamepad;

		if (!this._runned) {
			this._runned = true;
			self.requestAnimationFrame(this.updateStatus);
		}
	}

	onGamepadDisconnected({gamepad}) {		
		console.debug('[JoyServer]', 'Gamepad disconnected:', gamepad.id);

		this.fireUpEventDisconnect(gamepad);
		this.activeGamepads[gamepad.index] = null;

		delete this.heldButtons[gamepad.index];
		delete this.heldAxes[gamepad.index];

		const alive = [...navigator.getGamepads()].filter(Boolean);

		if (alive.length === 0) {
			this._runned = false;

			console.debug('[JoyServer]', 'Stop server, no more gamepads =(');
		}
	}

	start() {
		self.addEventListener('gamepadconnected', this.onGamepadConnected);
		self.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
	}

	stop() {

		if (this._runned) {
			this.activeGamepads.forEach((e) => e && this.fireUpEventDisconnect(e));
		}

		self.removeEventListener('gamepadconnected', this.onGamepadConnected);
		self.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);

		this.activeGamepads = [];
		this.heldAxes = [];
		this.heldButtons = [];
		this._runned = false;
	}

	changeProfile(profile = {}) {
		// we should emit up events for old profile and apply then new
		this.activeGamepads.forEach((e) => e && this.fireUpEventDisconnect(e));
		this.profiles = profile;

		console.debug('[JoyServer]', 'Update profiles:', profile);
	}
}
  
(async () =>  {
	const config = await new Promise( res => chrome.storage.sync.get(res));
	const profiles = config.profiles || {
		['any']: {
			buttons: [
				{
					'kind': 'key',
					'code': 'Space',
					'key': 'Space',
					'keyCode': 32,
					'which': 32,
					'bubbles': true,
					'cancelable': true,
					'composed': true,	
				}
			]
		}
	};

	const server = new JoyServer(profiles);

	window.onunload = () => {
		server.stop();
	}

	chrome.storage.onChanged.addListener((data, type) => {
		if (type !== 'sync' && data['profiles']) {
			return;
		}

		server.changeProfile(data['profiles'].newValue);
	});

	server.start();
})()