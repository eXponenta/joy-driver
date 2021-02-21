(() =>  {
    const all = {};
    for(let  i = 0; i < localStorage.length; i ++)
        all[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));

    console.log("local", all);
})()