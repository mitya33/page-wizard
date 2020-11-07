'use strict';

export default async function pageWizard(params) {

	/* ---
	| PREP
	--- */

	const appName = 'Page Wizard';

	//checks
	if (!params.data && !params.dataFileUri) return console.error(appName+' error - one of @data or @dataFileUri params must be passed');
	if (!params.cssFileUri) return console.error(appName+' error - @cssFileUri param not set');
	if (params.minWidth && parseInt(params.minWidth) && document.body.offsetWidth < params.minWidth) return console.log(appName+' - quit because screen width too small');
	if (params.effect && !['slide', 'fade'].includes(params.effect)) return console.log(appName+' error - @effect value "'+params.effect+'" is invalid');
	if (!params.effect) params.effect = 'slide';

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
	document.body.appendChild(darkScreen);

	//info area (footer)
	let infoArea = document.createElement('aside');
	infoArea.id = 'pwz-ia';
	infoArea.style.display = 'none';
	if (!params.singular) infoArea.innerHTML = '<a class="but pwz-disabled">&laquo;</a>';
	infoArea.innerHTML += '<h3></h3><p></p><a class="but">'+(!params.singular ? '&raquo;' : 'Got it')+'</a>';
	document.body.appendChild(infoArea);

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
		let css = await fetch(params.cssFileUri).then(r => r.text());
		let style = document.createElement('style');
		style.textContent = css;
		style.id = 'page-wizard-css';
		document.head.appendChild(style);
	}
	
	//data
	pageWizard.dataCache = pageWizard.dataCache || {};
	let data = params.data || pageWizard.dataCache[params.dataFileUri] || await fetch(params.dataFileUri).then(r => r.json());
	if (params.dataFileUri) pageWizard.dataCache[params.dataFileUri] = data;

	//show specific, singular slide?
	if (params.singular) data.forEach((obj, i) => { if (obj.selector == params.singular) next_feature_index = i; });

	//off we go
	highlight(next_feature_index);

	/* ---
	| MAIN - func for highlighting and explaining a given element
	--- */

	function highlight(index, dir) {

		//reached end...
		if (!data[index] || (dir == '>' && params.singular)) {

			//...clean up
			document.body.classList.remove('pwz-wizard-mode');
			infoArea.remove();
			darkScreen.remove();

			//...go back to top, if hash element provided
			if (params.onEndHash) location.hash = params.onEndHash.replace(/^#/, '');

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

		//...not reached end - put window in wizard mode (timeout ensures CSS transition)
		} else
			setTimeout(() => document.body.classList.add('pwz-wizard-mode'), 1);

		//highlight element and unhighlight previous, if there was one
		let hl = document.querySelectorAll('.highlighted');
		hl.length && hl.forEach(el => el.classList.remove('pwz-highlighted'));
		let els = document.querySelectorAll(data[next_feature_index].selector);
		els.length && els.forEach(el => el.classList.add('pwz-highlighted'));

		//no el(s) found? Skip to next/prev item
		if (!els.length) highlight(dir == '>' ? next_feature_index++ : next_feature_index--);

		//if element is position fixed and anchored bottom, will be hidden behind info area; temporarily bring it up
		els.forEach(el => {
			if (getComputedStyle(el).position == 'fixed' && getComputedStyle(el).bottom == '0px') el.style.bottom = infoArea.offsetHeight+'px';
		});

		//scroll to element - can't seem to do this with fancy scroll as element doesn't go to top of page
		location.href = '#'+data[next_feature_index].selector;

		//write explanatory content
		infoArea.querySelector('h3').textContent = data[next_feature_index].title;
		infoArea.querySelector('p').innerHTML = data[next_feature_index].text;
		!params.singular && infoArea.querySelector('a.but:first-of-type').classList.toggle('pwz-disabled', !index);

	}

	//log that we've run - means on subsequent runs, no need to re-fetch CSS
	pageWizard.hasRun = 1;

};
