// Unit test 1: delete employee
const {JSDOM} = require('jsdom');
const {deleteEmployee, viewEmployeeDetails} = require('../public/script');

test('deleteEmployee calls alert on success', async() => {
    //mock fetch
    global.authFetch = jest.fn(() => Promise.resolve({ ok: true }));
    global.loadEmployeeList=jest.fn();

    await deleteEmployee('123');
    expect(global.alert).toHaveBeenCalledWith('Employee deleted successfully');
});