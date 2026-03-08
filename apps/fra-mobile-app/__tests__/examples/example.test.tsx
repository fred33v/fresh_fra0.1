describe('Jest Configuration Test', () => {
  it('should perform basic arithmetic', () => {
    expect(2 + 2).toBe(4);
    expect(10 * 5).toBe(50);
  });

  it('should handle string operations', () => {
    expect('Hello ' + 'World').toBe('Hello World');
    expect('test'.toUpperCase()).toBe('TEST');
  });

  it('should work with arrays', () => {
    const numbers = [1, 2, 3, 4, 5];
    expect(numbers.length).toBe(5);
    expect(numbers[0]).toBe(1);
    expect(numbers.includes(3)).toBe(true);
  });

  it('should work with objects', () => {
    const user = { name: 'Test User', age: 30 };
    expect(user.name).toBe('Test User');
    expect(user.age).toBe(30);
  });
});
