import { JoyRenderer } from './renderer.js';

const layoutUrl = (type) => `./src/svg/${type}.svg`;


/**
 * 
 * @param {string} type 
 * @param {HTMLDivElement} target 
 */
async function attachLayout(type = 'xbox', target) {
	const r = await fetch(layoutUrl(type));
	const text = await r.text();

	target.innerHTML += text;

	const node = target.querySelector('svg');
	// remap labels to ID
	node.querySelectorAll('[inkscape\\:label]')
		.forEach((e) => e.id = e.getAttribute('inkscape:label'));

	// apply viewpox
	if (!node.getAttribute('viewBox')) {
		node.setAttribute('viewBox', `0 0 ${parseInt(node.width.baseVal.value)} ${parseInt(node.height.baseVal.value)}`);
	}

	return new JoyRenderer(node);
}

(async () => {
	/**
	 * @type {HTMLSelectElement}
	 */
	const select = document.querySelector('#processed-joy');
	const rendere = await attachLayout('xbox', document.querySelector('#joy'));
	const profiles = await new Promise( res => chrome.storage.sync.get(res));

	let lastSelectedId = localStorage.getItem('last_used_joy') || '';

	/**
	 * 
	 * @param {Gamepad[]} gamepadList 
	 */
	const populateSelect = (gamepadList) => {

		select.innerHTML = '';

		gamepadList = gamepadList.filter(Boolean);

		if (!gamepadList || !gamepadList.length) {
			return;
		}

		gamepadList.forEach((e, i) => {
			select.appendChild(new Option(e.id, i, 0, e.id === lastSelectedId || i === 0));
		});
	}

	const changeLayout = () => {
		const pad = navigator.getGamepads()[select.selectedIndex];

		if (pad) {
			lastSelectedId = pad.id;
			localStorage.setItem('last_used_joy', lastSelectedId);
		}

		rendere.bindPad(pad);
		console.log("Render Pad:", pad);
	}

	select.addEventListener('change', changeLayout);

	self.addEventListener("gamepadconnected", () => {
		populateSelect([...navigator.getGamepads()]);
		changeLayout();
	});

	self.addEventListener("gamepaddisconnected", () => {
		populateSelect([...navigator.getGamepads()]);
		changeLayout();
	});

})();