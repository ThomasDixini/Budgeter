using System.Runtime.CompilerServices;

[assembly: InternalsVisibleTo("Budgeter.Api.Tests")]

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/", () => "Hello World!");

await app.RunAsync();
