export class NodeBlock {
	/**
	 * @param {SVGElement} root
	 * @param {string} name 
	 */
	constructor(root, name) {
		this.root = root;
		this.name = name;
		this.lastValue = 0;

		this.body = root.querySelector(`#${name}_body`) || root;
		this.shadow = root.querySelector(`#${name}_shadow`);
	}

	activate(value = 0) {
		value = (value * 1000 | 0 ) / 1000;
		if (value === this.lastValue)
			return false;


		this.lastValue = value;
		return true;
	}

	reset() {
		this.activate(0);
	}
}

export class ButtonBlock extends NodeBlock {
	/**
	 * @param {SVGElement} root
	 * @param {number} id 
	 */
	constructor(root, id = 0) {
		super(root, 'button_' + id);

		this.id = id;
	}

	activate(value = 0) {
		const changed = super.activate(value);
		const id = this.id;
		const moveTop = id < 4 || id === 8 || id === 9;
		const direction = moveTop ? -1 : 1;

		if (changed) {
			console.log('Button ' + this.name, !!value ? 'pressed' : 'released');

			const height = this.body.getBoundingClientRect().height * 0.2;
			const shift = (direction * value * height) | 0;

			this.body.style.transform = `translate(0px, ${shift}px)`;
			this.body.style.transition = 'transform 0.1s';

			if (this.body !== this.root) {
				this.root.style.transform = `translate(0px, ${-shift * 0.25}px)`;
				this.root.style.transition = 'transform 0.1s';
			}
		}

		return changed;
	}
}

export class EventNode extends NodeBlock {
	activate(value) {
		const state = super.activate(value);
		
		state && this.onActivate && this.onActivate(value, this);

		return state;
	}
}

export class AxesBlock extends NodeBlock {
		/**
	 * @param {SVGElement} root
	 * @param {string} name 
	 */
	constructor(root, name) {
		super(root, name);

		this.motionDistance = 20;
		this.horizontal = new EventNode(root, name);
		this.vertical = new EventNode(root, name);

		this.horizontal.onActivate = this.activate.bind(this);
		this.vertical.onActivate = this.activate.bind(this)
	}

	/**
	 * 
	 * @param {number} value 
	 * @param {NodeBlock} source 
	 */
	activate(_value = 0, _source) {
		//console.log('POV ' + this.name, !!value ? 'pressed' : 'released');

		const shiftX = (this.horizontal.lastValue * this.motionDistance) | 0;
		const shiftY = (this.vertical.lastValue  *  this.motionDistance) | 0;

		this.body.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
		this.body.style.transition = 'transform 0.1s';

		return true;
	}
};

export class PovBlock extends AxesBlock {
	/**
	 * @param {SVGElement} root
	 * @param {string} name 
	 */
	constructor(root, name) {
		super(root, name);

		this.buttons = [
			new EventNode(root, 'button_14'),
			new EventNode(root, 'button_15'),
			new EventNode(root, 'button_12'),
			new EventNode(root, 'button_13'),
		];

		this.buttons[0].onActivate = (value) => this.vertical.activate(-value);
		this.buttons[1].onActivate = (value) => this.vertical.activate(value);

		this.buttons[2].onActivate = (value) => this.horizontal.activate(-value);
		this.buttons[3].onActivate = (value) => this.horizontal.activate(value);

		this.motionDistance = 15;
	}
};

class HintBlock {
	/**
	 * 
	 * @param {SVGTextElement} node
	 * @param {JoyRenderer} render
	 */
	constructor(node, render) {
		this.render = render;
		this.id = node.id;
		this.node = node;
		this.default = node.textContent;

		// styles
		this.node.style.cursor = 'pointer';
		this.node.style.userSelect = 'none';

		this.node.addEventListener('click', () => this.render.onHintEditRequesting(this));
	}

	get value() {
		return this.node.textContent;
	}

	set value(v) {
		this.node.textContent = v;
	}
}

export class JoyRenderer {
	/**
	 * 
	 * @param {SVGElement} node 
	 */
	constructor(node) {
		this.node = node;

		/**
		 * @type {NodeBlock[]}
		 */
		this.buttons = [];

		/**
		 * @type {NodeBlock[]}
		 */
		this.axes = [];

		/**
		 * @type {HintBlock[]}
		 */
		this.hints = [];

		/**
		 * @type {number}
		 */
		this.padIndex = -1;
		
		/**
		 * @type {HTMLDivElement}
		 */
		this.hintSelector = document.querySelector('#keycode_request');
		
		/**
		 * @type {HTMLDivElement}
		 */
		this.hintSelectorResult = document.querySelector('#keycode_request_result');

		/**
		 * @type {HintBlock}
		 */
		this.activeHint = null;

		this.update = this.update.bind(this);
		this.onKeyDown = this.onKeyDown.bind(this);
		this.onMouseClick = this.onMouseClick.bind(this);

		self.addEventListener('contextmenu', e => e.preventDefault());
		this.init();
	}

	init() {
		for (let i = 0; i < 16; i++) {
			const name = 'button_' + i;
			const element = this.node.querySelector(`#${name}`);

			if (element) {
				this.buttons[i] = new ButtonBlock(element, i);
			}
		}

		// pov
		// remap buttons to axes
		const pov = this.node.querySelector('#axes_pov');
		if (pov) {
			const root = new PovBlock(pov, 'axes_pov');

			for (let i = 12; i < 16; i++) {
				this.buttons[i] = root.buttons[i - 12];
			}
		}

		const axis_left = this.node.querySelector('#axes_left');
		if (axis_left) {
			const root = new AxesBlock(axis_left, 'axes_left');
			
			this.axes[0] = root.horizontal;
			this.axes[1] = root.vertical;
		}

		const axis_right = this.node.querySelector('#axes_right');
		if (axis_right) {
			const root = new AxesBlock(axis_right, 'axes_right');
			
			this.axes[2] = root.horizontal;
			this.axes[3] = root.vertical;
		};

		const hints = this.node.querySelectorAll('#hints > text');

		this.hints = Array.prototype.map.call(hints, (e) => new HintBlock(e, this));
	}

	/**
	 * 
	 * @param {HintBlock} hint 
	 */
	onHintEditRequesting(hint) {
		const rect = hint.node.getBoundingClientRect();
		this.hintSelector.style.display = 'block';

		if (rect.x + this.hintSelector.clientWidth >= window.innerWidth) {
			this.hintSelector.style.left = (rect.right - this.hintSelector.clientWidth) + 'px';
		} else {
			this.hintSelector.style.left = rect.left + 'px';
		}

		this.hintSelectorResult.textContent = hint.value;
		this.hintSelector.style.top = rect.y;
		this.activeHint = hint;

		document.addEventListener('mousedown', ({currentTarget}) => {
			if (currentTarget === this.hintSelector) {
				return;
			}

			this.hintSelector.style.display = 'none';
			this.activeHint = null;

			self.removeEventListener('keydown', this.onKeyDown);
			this.hintSelector.removeEventListener('mousedown', this.onMouseClick);

		}, {once: true});

		this.hintSelector.addEventListener('mousedown', this.onMouseClick);

		self.addEventListener('keydown', this.onKeyDown , {once: true})
	}

	onMouseClick(event) {		
		event.stopPropagation();

		if (event.target.id === 'keycode_request_reset') {
			this.hintSelectorResult.textContent = '...';
			this.activeHint.value = this.activeHint.default;
		} else {
			this.hintSelectorResult.textContent = 'Mouse ' + event.button;
			this.activeHint.value = 'Mouse ' + event.button;
		}

		setTimeout(() => {
			this.hintSelector.style.display = 'none';
		}, 1000);
	}

	onKeyDown({code}) {
		this.hintSelectorResult.textContent = code;
		this.activeHint.value = code;

		setTimeout(() => {
			this.hintSelector.style.display = 'none';
		}, 1000);
	}

	update() {
		if (this.padIndex === -1) {
			return;
		}

		const pad = navigator.getGamepads()[this.padIndex];

		pad.buttons.forEach((e, i) => {
			if (this.buttons[i]) {
				this.buttons[i].activate(e.value);
			}
		});

		pad.axes.forEach((e, i) => {
			if(this.axes[i]) {
				this.axes[i].activate(e);
			}
		});

		requestAnimationFrame(this.update);
	}
	/**
	 * 
	 * @param {Gamepad} pad 
	 */
	bindPad(pad) {
		this.padIndex = pad ? pad.index : -1;

		if (!pad) {
			this.reset();
		} else {
			this.update();
		}
	}

	reset() {
		this.buttons.forEach((e) => e && e.reset());
		this.axes.forEach((e) => e && e.reset());
	}
}