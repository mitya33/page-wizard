'use strict';

window.pageWizard = async params => {

	/* ---
	| PREP
	--- */

	const appName = 'Page Wizard',
		bod = document.body,
		docEl = document.documentElement,
		floatBuffer = 20,
		rand = Math.random(),
		startScrollTop = docEl.scrollTop,
		sivOpts = {behavior: 'smooth'};

	//checks
	if (!params.data && !params.dataFileUri) return console.error(appName+' error - one of @data or @dataFileUri params must be passed');
	if (!params.cssFileUri) return console.error(appName+' error - @cssFileUri param not set');
	if (params.minWidth && parseInt(params.minWidth) && bod.offsetWidth < params.minWidth) return console.log(appName+' - quit because screen width too small');
	if (params.mode && !['floor', 'float'].includes(params.mode)) return console.error(appName+' error - @mode value "'+params.mode+'" is invalid');
	if (params.onEndReturnTo && !['top', 'orig'].includes(params.onEndReturnTo)) return console.error(appName+' error - @onEndReturnTo value "'+params.onEndReturnTo+'" is invalid');
	if (!params.mode) params.mode = 'float';

	//prompt?
	params.prompt && await new Promise(res => {
		!window.lblib ?
			confirm(params.prompt) && res() :
			lblib.confirm(params.prompt).then(r => r && res());
	});

	//set start point
	let next_feature_index = 0;

	/* ---
	| ELEMENTS
	--- */

	//dark overlay
	let darkScreen = document.createElement('div');
	darkScreen.id = 'pwz-ds';
	bod.appendChild(darkScreen);

	//info area
	let infoArea = document.createElement('aside');
	infoArea.id = 'pwz-ia';
	infoArea.style.display = 'none';
	if (!params.singular) infoArea.innerHTML = '<a class="but pwz-disabled">&laquo;</a>';
	infoArea.innerHTML += '<h3></h3><p></p><a class="but">'+(!params.singular ? '&raquo;' : params.gotItBtn || 'Got it!')+'</a>';
	bod.appendChild(infoArea);

	//nav
	infoArea.addEventListener('click', evt => {
		let isNext = evt.target.matches(':last-of-type');
		if (!evt.target.matches('a.but:not(.pwz-disabled)')) return;
		isNext ? next_feature_index++ : next_feature_index--;
		highlight(next_feature_index, isNext ? '>' : '<');
	});

	/* ---
	| GET CSS/DATA - then prompt whether to show wizard
	--- */

	//css
	if (!pageWizard.hasRun) {
		let css = await fetch(params.cssFileUri+'?r='+rand).then(r => r.text());
		let style = document.createElement('style');
		style.textContent = css;
		style.id = 'page-wizard-css';
		document.head.appendChild(style);
	}
	
	//data
	pageWizard.dataCache = pageWizard.dataCache || {};
	let data = params.data || pageWizard.dataCache[params.dataFileUri] || await fetch(params.dataFileUri+'?r='+rand).then(r => r.json());
	if (params.dataFileUri) pageWizard.dataCache[params.dataFileUri] = data;

	//show specific, singular slide?
	if (params.singular) data.forEach((obj, i) => { if (obj.selector == params.singular) next_feature_index = i; });

	//off we go
	highlight(next_feature_index);

	/* ---
	| MAIN - func for highlighting and explaining a given element
	--- */

	function highlight(index, dir) {

		//unhighlight last-highlighted element, if there was one
		let hl = document.querySelector('.pwz-highlighted');
		hl && hl.remove();

		//reached end...
		if (!data[index] || (dir == '>' && params.singular)) {

			//...clean up
			bod.classList.remove('pwz-active', 'pwz-mode-floor', 'pwz-mode-float', 'pwz-singular');
			infoArea.remove();
			darkScreen.remove();

			//...go to top, or to original scrolltop point, if requested
			if (params.onEndReturnTo)
				if (params.onEndReturnTo == 'top') docEl.scrollIntoView(sivOpts);
				else docEl.scrollTop = startScrollTop;

			//...on end callback?
			params.onEndCallback && params.onEndCallback();

			//...on end message? (Not if singular mode)
			if (params.onEndMessage && !params.singular) {
				if (!(params.onEndMessage instanceof Array)) params.onEndMessage = [params.onEndMessage];
				!window.lblib ?
					alert(params.onEndMessage.join('\n\n')) :
					lblib.modal({
						title: "That's it!",
						content: params.onEndMessage.join('</p><p>'),
						OKButton: {
							noLBClose: 1,
							callback: () => params.endCallback && params.endCallback()
						},
						cancelButton: !params.watchAgain ? null : {
							text: 'Watch again',
							callback: () => {
								lblib.hide();
								next_feature_index = 0;
								delete params.prompt;
								pageWizard(params);
							}
						}
					});
			}
			return;

		}

		//beyond here, not reached end yet

		//put window in wizard mode (timeout ensures CSS transition)
		setTimeout(() => bod.classList.add('pwz-active', 'pwz-mode-'+params.mode, 'pwz-singular-'+!!params.singular), 1);

		//get next element - skip to next/prev item if not found/hidden
		let el = document.querySelector(data[next_feature_index].selector);
		if (!el || getComputedStyle(el).display == 'none' || getComputedStyle(el).visibility == 'hidden')
			return highlight(dir == '>' ? next_feature_index++ : next_feature_index--);

		//clone element and children/descendants - remove id, class and data attributes - we'll clamp in place all computed styling, so they're not needed
		let clone = el.cloneNode(1);
		clone.removeAttribute('id');
		el.id && clone.setAttribute('data-orig-id', el.id);
		clone.style.position = 'absolute';
		clone.style.left = el.offsetLeft+'px';
		clone.style.top = el.offsetTop+'px';
		clone.style.width = el.offsetWidth+'px';
		clone.style.margin = 0;
		clone.classList.add('pwz-highlighted');
		bod.appendChild(clone);

		//float mode?...
		delete infoArea.dataset.pos;
		if (params.mode == 'float') {

			//...position info area wherever there's most space around the target element
			let edges = ['top', 'right', 'bottom', 'left'],
				space = edges.reduce((acc, edge) => {
				switch (edge[0]) {
					case 't':
					case 'l':
						acc[edge] = el['offset'+(edge[0] == 't' ? 'Top' : 'Left')];
						return acc;
					case 'r':
					case 'b':
						let prop = edge[0] == 'r' ? 'Width' : 'Height';
						acc[edge] = window['inner'+prop] - (el['offset'+(edge[0] == 'r' ? 'Left' : 'Top')] + el['offset'+prop]);
						return acc;
				}
			}, {});
			let side = Object.keys(space)[Object.values(space).indexOf(Math.max.apply(null, Object.values(space)))];
			infoArea.dataset.pos = side;
			edges.forEach(edge => el.style[edge] = 'auto');
			switch (side[0]) {
				case 't':
				case 'b':
					infoArea.style.left = el.offsetLeft + (el.offsetWidth / 2) - (infoArea.offsetWidth / 2)+'px';
					infoArea.style.top = (side[0] == 't' ? space.top - (infoArea.offsetHeight + floatBuffer) : innerHeight - (space.bottom - floatBuffer))+'px';
					break;
				case 'l':
				case 'r':
					infoArea.style.left = (side[0] == 'l' ? space.left - (infoArea.offsetWidth + floatBuffer) : innerWidth - (space.right - floatBuffer))+'px';
					infoArea.style.top = el.offsetTop+'px';
					break;
			}

			//...scroll info area into view - not sure why the timeout is needed; without it, sometimes the scroll position ends up wrong
			setTimeout(() => infoArea.scrollIntoView({...sivOpts, block: 'center'}), 1);

		//floor mode?...
		} else {

			//...scroll target element into view
			el.scrollIntoView();

			//if element is position fixed and anchored bottom, will be hidden behind info area; temporarily bring it up
			if (getComputedStyle(el).position == 'fixed' && getComputedStyle(el).bottom == '0px') el.style.bottom = infoArea.offsetHeight+'px';

		}

		//write explanatory content
		infoArea.querySelector('h3').textContent = data[next_feature_index].title;
		infoArea.querySelector('p').innerHTML = data[next_feature_index].text;
		!params.singular && infoArea.querySelector('a.but:first-of-type').classList.toggle('pwz-disabled', !index);

	}

	//log that we've run - means on subsequent runs, no need to re-fetch CSS
	pageWizard.hasRun = 1;

};
