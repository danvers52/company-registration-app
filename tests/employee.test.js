// Unit test 1: delete employee
describe.skip('Auth API Integration Tests', () => {
  // this suite will be skipped
    import jsdom from 'jsdom';
    import {deleteEmployee, viewEmployeeDetails} from '../public/script';

    test('deleteEmployee calls alert on success', async() => {
        //mock fetch
        global.authFetch = jest.fn(() => Promise.resolve({ ok: true }));
        global.loadEmployeeList=jest.fn();

        await deleteEmployee('123');
        expect(global.alert).toHaveBeenCalledWith('Employee deleted successfully');
    });
});


