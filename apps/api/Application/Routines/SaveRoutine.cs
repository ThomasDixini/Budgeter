using Budgeter.Api.Application.Categories;
using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Application.Routines;

public sealed record SaveRoutineBlockCommand(string Id, string Name, string Start, string End, string? CategoryId);

public sealed record SaveRoutineCommand(
    string Id,
    string Name,
    IReadOnlyList<int> Days,
    string Start,
    string End,
    IReadOnlyList<SaveRoutineBlockCommand> Blocks);

/// <summary>
/// Creates or replaces a routine as a whole; saving the same routine twice leaves the same state,
/// so a retried request is harmless.
/// </summary>
public sealed class SaveRoutine(IRoutineRepository routines, ICategoryRepository categories)
{
    /// <summary>
    /// Validates the routine, checks every block category exists and stores it.
    /// </summary>
    /// <example><code>await saveRoutine.ExecuteAsync(new SaveRoutineCommand("weekdays", "Weekdays", [0, 1, 2, 3, 4], "08:00", "17:00", []), ct);</code></example>
    public async Task<Routine> ExecuteAsync(SaveRoutineCommand command, CancellationToken cancellationToken)
    {
        var routine = ToRoutine(command);
        foreach (var categoryId in routine.CategoryIds)
        {
            await RequireCategoryAsync(categoryId, cancellationToken);
        }
        await routines.SaveAsync(routine, cancellationToken);
        return routine;
    }

    private static Routine ToRoutine(SaveRoutineCommand command)
    {
        var blocks = command.Blocks.Select(block =>
            RoutineBlock.Create(block.Id, block.Name, block.Start, block.End, block.CategoryId));
        return Routine.Create(command.Id, command.Name, command.Days, command.Start, command.End, blocks);
    }

    private async Task RequireCategoryAsync(string categoryId, CancellationToken cancellationToken)
    {
        var category = await categories.FindAsync(categoryId, cancellationToken);
        if (category is null) throw ResourceNotFoundException.For("category", categoryId);
    }
}
