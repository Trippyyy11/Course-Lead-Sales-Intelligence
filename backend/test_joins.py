import pandas as pd
import numpy as np

def mock_load_dataframe(data):
    return pd.DataFrame(data)

def normalize_val(val):
    """Safe normalization: trim + lowercase only. No digit extraction."""
    if pd.isna(val):
        return val
    return str(val).strip().lower()

def perform_join_logic(df_a, df_b, keys_a, keys_b, join_type):
    df_a = df_a.copy()
    df_b = df_b.copy()

    # Apply safe normalization to join keys
    for col in keys_a:
        if col in df_a.columns:
            df_a[col] = df_a[col].apply(normalize_val)
    for col in keys_b:
        if col in df_b.columns:
            df_b[col] = df_b[col].apply(normalize_val)

    # CRITICAL: Deduplicate on join keys BEFORE merging to prevent
    # M×N cartesian product when same key appears multiple times in both files
    if join_type != "append":
        valid_keys_a = [k for k in keys_a if k in df_a.columns]
        valid_keys_b = [k for k in keys_b if k in df_b.columns]
        if valid_keys_a:
            df_a = df_a.drop_duplicates(subset=valid_keys_a, keep='first')
        if valid_keys_b:
            df_b = df_b.drop_duplicates(subset=valid_keys_b, keep='first')

    if join_type == "append":
        common_columns = list(set(df_a.columns) & set(df_b.columns))
        return pd.concat([df_a[common_columns], df_b[common_columns]], ignore_index=True)
    elif join_type == "left_anti":
        merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="left", indicator=True, suffixes=("_fileA", "_fileB"))
        merged_df = merged_df[merged_df["_merge"] == "left_only"].drop(columns=["_merge"])
        cols_to_keep = [c for c in merged_df.columns if not c.endswith("_fileB")]
        merged_df = merged_df[cols_to_keep]
        merged_df.columns = [c.replace("_fileA", "") if c.endswith("_fileA") else c for c in merged_df.columns]
        return merged_df.drop_duplicates()
    elif join_type == "right_anti":
        merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="right", indicator=True, suffixes=("_fileA", "_fileB"))
        merged_df = merged_df[merged_df["_merge"] == "right_only"].drop(columns=["_merge"])
        cols_to_keep = [c for c in merged_df.columns if not c.endswith("_fileA")]
        merged_df = merged_df[cols_to_keep]
        merged_df.columns = [c.replace("_fileB", "") if c.endswith("_fileB") else c for c in merged_df.columns]
        return merged_df.drop_duplicates()
    elif join_type == "full_anti":
        merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="outer", indicator=True, suffixes=("_fileA", "_fileB"))
        return merged_df[merged_df["_merge"] != "both"].drop(columns=["_merge"]).drop_duplicates()
    else:
        merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how=join_type, suffixes=("_fileA", "_fileB"))
        return merged_df.drop_duplicates()

def test_joins():
    data_a = {"id": [1, 2, 3], "name": ["Alice", "Bob", "Charlie"]}
    data_b = {"id": [2, 3, 4], "age": [25, 30, 35]}
    df_a = pd.DataFrame(data_a)
    df_b = pd.DataFrame(data_b)
    
    keys = ["id"]

    print("Testing 'full_anti' (Symmetric Difference)...")
    result = perform_join_logic(df_a, df_b, keys, keys, "full_anti")
    print(result)
    assert len(result) == 2, f"Expected 2 rows, got {len(result)}"
    print("✓ full_anti passed\n")

    print("Testing 'left_anti'...")
    result = perform_join_logic(df_a, df_b, keys, keys, "left_anti")
    print(result)
    assert len(result) == 1, f"Expected 1 row, got {len(result)}"
    print("✓ left_anti passed\n")

    print("Testing 'right_anti'...")
    result = perform_join_logic(df_a, df_b, keys, keys, "right_anti")
    print(result)
    assert len(result) == 1, f"Expected 1 row, got {len(result)}"
    print("✓ right_anti passed\n")

    print("Testing 'outer'...")
    result = perform_join_logic(df_a, df_b, keys, keys, "outer")
    print(result)
    assert len(result) == 4, f"Expected 4 rows, got {len(result)}"
    print("✓ outer passed\n")

    print("Testing 'inner'...")
    result = perform_join_logic(df_a, df_b, keys, keys, "inner")
    print(result)
    assert len(result) == 2, f"Expected 2 rows, got {len(result)}"
    print("✓ inner passed\n")

def test_no_cartesian_product():
    """Verify duplicate keys in BOTH files don't produce cartesian explosion."""
    print("Testing cartesian product prevention (duplicate keys in both files)...")
    
    # Simulating real-world scenario: "ECO CYBER" appears 3× in A and 4× in B
    data_a = {
        "business_name": ["ECO CYBER", "ECO CYBER", "ECO CYBER", "ALPHA TECH"],
        "city": ["Munger", "Munger", "Munger", "Delhi"],
        "rating": [4.5, 4.5, 4.5, 3.0]
    }
    data_b = {
        "business_name": ["ECO CYBER", "ECO CYBER", "ECO CYBER", "ECO CYBER", "BETA CORP"],
        "phone": ["111", "111", "111", "111", "222"],
        "reviews": [10, 10, 10, 10, 20]
    }
    df_a = pd.DataFrame(data_a)
    df_b = pd.DataFrame(data_b)
    
    # Inner join on business_name
    result = perform_join_logic(df_a, df_b, ["business_name"], ["business_name"], "inner")
    print(f"  Result rows: {len(result)}")
    print(result)
    
    # Without pre-merge dedup this would be 3×4=12 rows for ECO CYBER alone!
    # With pre-merge dedup: 1 row for ECO CYBER (first from each side)
    assert len(result) == 1, f"Expected 1 row (ECO CYBER matched once), got {len(result)} -- CARTESIAN PRODUCT BUG!"
    print("✓ No cartesian product with duplicate keys!\n")

def test_string_key_exact_match():
    """Verify string-based joins produce exact matches only."""
    print("Testing string-key exact matching...")
    data_a = {
        "email": ["alice@test.com", "bob@test.com", "charlie@test.com"],
        "score": [100, 200, 300]
    }
    data_b = {
        "email": ["bob@test.com", "charlie@test.com", "dave@test.com"],
        "grade": ["A", "B", "C"]
    }
    df_a = pd.DataFrame(data_a)
    df_b = pd.DataFrame(data_b)
    
    result = perform_join_logic(df_a, df_b, ["email"], ["email"], "inner")
    print(result)
    assert len(result) == 2, f"Expected 2 rows, got {len(result)}"
    print("✓ String-key exact matching correct\n")

def test_name_join():
    """Verify name-based joins only match exact names."""
    print("Testing name-based exact matching...")
    data_a = {
        "name": ["Alice Johnson", "Bob Smith", "Charlie Brown"],
        "department": ["Sales", "Engineering", "HR"]
    }
    data_b = {
        "name": ["Alice Johnson", "David Wilson"],
        "salary": [50000, 60000]
    }
    df_a = pd.DataFrame(data_a)
    df_b = pd.DataFrame(data_b)
    
    result = perform_join_logic(df_a, df_b, ["name"], ["name"], "inner")
    print(result)
    assert len(result) == 1, f"Expected 1 row, got {len(result)}"
    print("✓ Name-based exact matching correct\n")

def test_left_join_no_explosion():
    """Verify left join doesn't explode with duplicate keys."""
    print("Testing left join with duplicate keys...")
    data_a = {
        "id": ["X1", "X1", "X2", "X3"],
        "val": ["a", "b", "c", "d"]
    }
    data_b = {
        "id": ["X1", "X1", "X2"],
        "info": ["p", "q", "r"]
    }
    df_a = pd.DataFrame(data_a)
    df_b = pd.DataFrame(data_b)
    
    result = perform_join_logic(df_a, df_b, ["id"], ["id"], "left")
    print(result)
    # After dedup: A has X1, X2, X3 (3 unique). B has X1, X2 (2 unique).
    # Left join: X1→matched, X2→matched, X3→no match = 3 rows
    assert len(result) == 3, f"Expected 3 rows, got {len(result)}"
    print("✓ Left join with duplicate keys correct\n")

if __name__ == "__main__":
    test_joins()
    test_no_cartesian_product()
    test_string_key_exact_match()
    test_name_join()
    test_left_join_no_explosion()
    print("🎉 All tests passed!")
