class JoyServer {
	constructor(profiles) {
		this.profiles = profiles || {};

		this.onGamepadConnected = this.onGamepadConnected.bind(this);
		this.onGamepadDisconnected = this.onGamepadDisconnected.bind(this);
		this.updateStatus = this.updateStatus.bind(this);

		this.heldButtons = [];
		this.heldAxes = [];
		this._runned = false;
	}

	/**
	 * 
	 * @param {Gamepad} pad 
	 */
	updatePad(pad, _time = 0) {
		const buttonsProfile = this.profiles[pad.id].buttons;
		const axesProfile = this.profiles[pad.id].axes;
		const axesTreshold = this.profiles.axesThreshold || 0.7;
		const btnLen = pad.buttons.length;
		const axesLen = pad.axes.length;
		const heldButtons = this.heldButtons[pad.index];
		const heldAxes = this.heldAxes[pad.index];

		for (let bIdx = 0; bIdx < btnLen; bIdx++) {
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
				} else if(heldButtons[gIdx][bIdx]) {
					heldButtons[gIdx][bIdx] = false;
					this.fireUpEvent(buttonsProfile[bIdx], from);
				}
			}
		}

		for (let aIdx = 0; aIdx < axesLen; aIdx ++) {
			const value = pad.axes[i];

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
		const buttonsProfile = this.profiles[pad.id].buttons;
		const axesProfile = this.profiles[pad.id].axes;
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

			if (!this.profiles[pad.id]) {
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

		if (!this._runned) {
			this._runned = true;
			self.requestAnimationFrame(this.updateStatus);
		}
	}

	onGamepadDisconnected({gamepad}) {		
		console.debug('[JoyServer]', 'Gamepad disconnected:', gamepad.id);

		this.fireUpEventDisconnect(gamepad);

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
		this._runned = false;
		
		self.removeEventListener('gamepadconnected', this.onGamepadConnected);
		self.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);

		this.heldAxes = [];
		this.heldButtons = [];

		[...navigator.getGamepads()].forEach((e) => this.fireUpEventDisconnect(e));
	}

	changeProfile(profile = {}) {
		// we should emit up events for old profile and apply then new
		[...navigator.getGamepads()].forEach((e) => this.fireUpEventDisconnect(e));
		this.profiles = profile;

		console.debug('[JoyServer]', 'Update profiles:', profile);
	}
}
  
(async () =>  {
	const config = await new Promise( res => chrome.storage.sync(res));
	const profiles = config.profiles;
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
})()