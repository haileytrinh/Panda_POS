let selectEntrees = [];
let selectSides = [];

function checkItems(containerType, itemType, index) {
    console.log('clicked!');
    if (containerType == "Bowl") {
        if (selectEntrees.length == 1 && itemType == 'entree') {
            alert('You can only select 1 entree.');
        }
        else if (selectEntrees.length < 1) {
            selectEntrees.push(index);
            disableUnselectedItems(itemType);
        }

        if (selectSides.length == 1 && itemType == 'side') {
            alert('You can only select 1 side.');
        }
        else if (selectSides.length < 1) {
            selectSides.push(index);
        }
    }
    if (containerType == "Plate") {
        if (selectEntrees.length == 2 && itemType == 'entree') {
            alert('You can only select 2 entrees.');
        }
        else if (selectEntrees.length < 2) {
            selectEntrees.push(index);
        }
        if (selectSides.length == 1 && itemType == 'side') {
            alert('You can only select 1 side.');
        }
        else if (selectSides.length < 1) {
            selectSides.push(index);
            disableUnselectedItems(itemType);
        }
    }
    if (containerType == "Bigger Plate") {
        if (selectEntrees.length == 3 && itemType == 'entree') {
            alert('You can only select 3 entrees.');
        }
        else if (selectEntrees.length < 3) {
            selectEntrees.push(index);
        }
        if (selectSides.length == 1 && itemType == 'side') {
            alert('You can only select 1 side.');
        }
        else if (selectSides.length < 1) {
            selectSides.push(index);
            disableUnselectedItems(itemType);
        }
    }

}

function disableUnselectedItems(itemType) {
    const items = document.querySelectorAll(`.card-${itemType}`);

    items.forEach((card, index) => {
        if ((itemType === 'entree' && !selectEntrees.includes(index)) ||
            (itemType === 'side' && !selectSides.includes(index))) {
            card.style.pointerEvents = 'none';
            card.style.opacity = '0.5';
            card.classList.add('disabled');
        } else {
            card.style.pointerEvents = 'auto';
            card.style.opacity = '1';
            card.classList.remove('disabled');
        }
    });
}